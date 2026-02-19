import type { Metadata } from 'next';
import ChatPage from '@/components/chat/ChatPage';

export const metadata: Metadata = {
  title: 'Chat - Zero Sum Nutrition',
  robots: { index: false },
};

export default function ChatRoute() {
  return <ChatPage />;
}
