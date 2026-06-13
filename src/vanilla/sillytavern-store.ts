import {
  getLorebooks, saveLorebook, deleteLorebook,
  getPresets, savePreset, deletePreset,
  getSettings, saveSettings, initializeDatabase,
  getChats, saveChat, deleteChat as deleteChatById,
  assemblePrompt, extractVariables, mergeVariables, USER_ROLE, truncateChatAt, branchChat,
  type Lorebook, type ChatPreset, type AppSettings, type ChatSession, type ChatMessage,
} from '../sillytavern';

type Listener = () => void;

export function createSillytavernStore() {
  let lorebooks: Lorebook[] = [];
  let presets: ChatPreset[] = [];
  let settings: AppSettings | null = null;
  let activeLorebookIds: string[] = [];
  let chats: ChatSession[] = [];
  let activeChatId: string | null = null;
  let isSending = false;
  let isLoading = true;
  const listeners = new Set<Listener>();

  const notify = () => listeners.forEach(cb => cb());

  const loadAll = async () => {
    isLoading = true;
    notify();
    await initializeDatabase();
    const [l, p, s, c] = await Promise.all([getLorebooks(), getPresets(), getSettings(), getChats()]);
    lorebooks = l;
    presets = p;
    settings = s || null;
    activeLorebookIds = s?.activeLorebookIds || [];
    chats = c;
    isLoading = false;
    notify();
  };

  const toggleLorebook = async (id: string) => {
    const newIds = activeLorebookIds.includes(id)
      ? activeLorebookIds.filter(i => i !== id)
      : [...activeLorebookIds, id];
    activeLorebookIds = newIds;
    if (settings) {
      const newSettings = { ...settings, activeLorebookIds: newIds };
      await saveSettings(newSettings);
      settings = newSettings;
    }
    notify();
  };

  const updateSettings = async (updates: Partial<AppSettings>) => {
    if (!settings) return;
    const newSettings = { ...settings, ...updates };
    await saveSettings(newSettings);
    settings = newSettings;
    notify();
  };

  const createChat = async (name?: string) => {
    if (!settings) throw new Error('Settings not loaded');
    const s = settings!;
    const chatCount = chats.filter(c => c.characterName === s.characterName).length;
    const chatName = name || `${s.characterName} - 新对话 ${chatCount + 1}`;
    const newChat: ChatSession = {
      id: crypto.randomUUID(),
      name: chatName,
      messages: [],
      characterName: s.characterName,
      userName: s.userName,
      presetId: s.activePresetId || presets[0]?.id || null,
      lorebookIds: [...activeLorebookIds],
      variables: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveChat(newChat);
    chats = [...chats, newChat];
    activeChatId = newChat.id;
    notify();
    return newChat.id;
  };

  const loadChat = (id: string) => {
    if (activeChatId === id) return;
    activeChatId = id;
    notify();
  };

  const deleteChat = async (id: string) => {
    await deleteChatById(id);
    chats = chats.filter(c => c.id !== id);
    if (activeChatId === id) activeChatId = null;
    notify();
  };

  const updateVariables = async (updates: Record<string, string | number>) => {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;
    const merged = mergeVariables(activeChat.variables, updates);
    const updatedChat = { ...activeChat, variables: merged, updatedAt: Date.now() };
    await saveChat(updatedChat);
    chats = chats.map(c => c.id === updatedChat.id ? updatedChat : c);
    notify();
  };

  const sendMessage = async (content: string) => {
    if (!settings || !activeChatId) throw new Error('No active chat or settings not loaded');
    const s = settings;
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) throw new Error('Active chat not found');

    isSending = true;
    notify();

    try {
      const activePreset = presets.find(p => p.id === s.activePresetId) || presets[0];
      if (!activePreset) throw new Error('No preset available');

      const activeBooks = lorebooks.filter(b => activeLorebookIds.includes(b.id));
      const currentVariables = activeChat.variables || {};

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
        variables: { ...currentVariables },
      };

      const updatedMessages = [...activeChat.messages, userMessage];
      let updatedChat = { ...activeChat, messages: updatedMessages, updatedAt: Date.now() };

      const { messages: promptMessages } = assemblePrompt({
        userInput: content,
        history: updatedMessages,
        preset: activePreset,
        lorebooks: activeBooks,
        userName: s.userName,
        characterName: s.characterName,
        variables: currentVariables,
      });

      const requestBody: Record<string, any> = {
        model: activePreset.settings.openai_model || s.api.model,
        messages: promptMessages,
      };
      if (activePreset.settings.temp_openai !== undefined) requestBody.temperature = activePreset.settings.temp_openai;
      if (activePreset.settings.openai_max_tokens !== undefined) requestBody.max_tokens = activePreset.settings.openai_max_tokens;
      if (activePreset.settings.top_p_openai !== undefined) requestBody.top_p = activePreset.settings.top_p_openai;
      if (activePreset.settings.freq_pen_openai !== undefined) requestBody.frequency_penalty = activePreset.settings.freq_pen_openai;
      if (activePreset.settings.pres_pen_openai !== undefined) requestBody.presence_penalty = activePreset.settings.pres_pen_openai;
      if (activePreset.settings.stream_openai !== undefined) requestBody.stream = activePreset.settings.stream_openai;

      const response = await fetch(s.api.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${s.api.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      const rawReply = data.choices?.[0]?.message?.content || '';
      const { cleanedText: reply, updates: extractedVars } = extractVariables(rawReply);
      const nextVariables = mergeVariables(currentVariables, extractedVars);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
        variables: { ...nextVariables },
      };

      updatedChat = { ...updatedChat, messages: [...updatedChat.messages, assistantMessage], variables: nextVariables };
      await saveChat(updatedChat);
      chats = chats.map(c => c.id === updatedChat.id ? updatedChat : c);
    } finally {
      isSending = false;
      notify();
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;
    const idx = activeChat.messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    if (activeChat.messages[idx].role !== USER_ROLE) return;

    const updatedChat = truncateChatAt(activeChat, idx, activeChat.messages[idx].variables);
    await saveChat(updatedChat);
    chats = chats.map(c => c.id === updatedChat.id ? updatedChat : c);
    notify();
    await sendMessage(newContent);
  };

  const deleteMessagesFrom = async (messageId: string) => {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat) return;
    const idx = activeChat.messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;

    const updatedChat = truncateChatAt(activeChat, idx);
    await saveChat(updatedChat);
    chats = chats.map(c => c.id === updatedChat.id ? updatedChat : c);
    notify();
  };

  const branchFromMessage = async (messageId: string, name?: string) => {
    const activeChat = chats.find(c => c.id === activeChatId);
    if (!activeChat || !settings) throw new Error('No active chat');
    const s = settings;
    const idx = activeChat.messages.findIndex(m => m.id === messageId);
    if (idx === -1) throw new Error('Message not found');

    const branchCount = chats.filter(c => c.characterName === s.characterName).length;
    const branchName = name || `${s.characterName} - 分支 ${branchCount + 1}`;
    const newChat = branchChat(activeChat, idx, {
      name: branchName,
      presetId: s.activePresetId || presets[0]?.id || null,
      lorebookIds: [...activeLorebookIds],
      variables: activeChat.messages[idx].variables,
    });
    await saveChat(newChat);
    chats = [...chats, newChat];
    activeChatId = newChat.id;
    notify();
    return newChat.id;
  };

  const subscribe = (cb: Listener) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };

  return {
    get lorebooks() { return lorebooks; },
    get presets() { return presets; },
    get settings() { return settings; },
    get activeLorebookIds() { return activeLorebookIds; },
    get chats() { return chats; },
    get activeChatId() { return activeChatId; },
    get activeChat() { return chats.find(c => c.id === activeChatId) || null; },
    get isSending() { return isSending; },
    get isLoading() { return isLoading; },
    loadAll,
    toggleLorebook,
    updateSettings,
    createChat,
    loadChat,
    deleteChat,
    sendMessage,
    updateVariables,
    editMessage,
    deleteMessagesFrom,
    branchFromMessage,
    saveLorebook,
    deleteLorebook,
    savePreset,
    deletePreset,
    subscribe,
  };
}

export const sillytavernStore = createSillytavernStore();
