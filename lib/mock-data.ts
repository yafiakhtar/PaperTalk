export interface MockPaper {
  id: string;
  title: string;
  status: "ready" | "processing";
}

export interface MockMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const MOCK_PAPERS: MockPaper[] = [
  { id: "1", title: "Attention Is All You Need", status: "ready" },
  { id: "2", title: "BERT: Pre-training of Deep Bidirectional Transformers", status: "ready" },
  { id: "3", title: "Scaling Laws for Neural Language Models", status: "processing" }
];

export const MOCK_INITIAL_MESSAGES: MockMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content: "Upload a paper or select one from the sidebar to start chatting."
  }
];

export const MOCK_ASSISTANT_REPLY =
  "Based on the paper, the key contribution is a novel architecture that improves efficiency while maintaining performance on benchmark tasks.";
