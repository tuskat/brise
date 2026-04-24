/**
 * Chat shared state — mutable state + DOM helper shared by all chat modules.
 * Breaks circular-dependency concerns: no module imports from another that
 * imports back; everything imports from this lightweight state holder.
 */

export const chatState = {
  conversations: [],
  activeConversationId: null,
  isLoading: false,
  searchQuery: '',
};

export const $ = (id) => document.getElementById(id);
