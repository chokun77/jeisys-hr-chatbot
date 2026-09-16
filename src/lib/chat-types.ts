// page.tsx(서버)·chat-client.tsx·route.ts·chat-history.ts가 공유하는 대화 메시지 타입.

export type Source = {
  title: string;
  category: string;
  updatedAt: string;
  channel?: string;
};

export type Message = {
  role: "user" | "bot";
  text: string;
  sources?: Source[];
  handoff?: boolean;
};
