// ============================================
// MyBotIA Premium Interface — Core Types
// ============================================

export type UserRole = 'dirigeant' | 'commercial' | 'it_admin' | 'support_ops' | 'collaborateur';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  company: string;
}

export type AgentStatus = 'online' | 'busy' | 'offline' | 'listening' | 'speaking' | 'thinking';

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  model: string;
  status: AgentStatus;
  avatar?: string;
  /** Photo URL (Cloudinary, /public/agents/...). Falls back to initials if absent. */
  photo?: string;
  /** Hue 0-360 used as a signature color ring around the orb. */
  hue?: number;
  /** Short live transcript line rendered in the right rail. */
  liveTranscript?: string;
  channels: string[];
  lastActive?: string;
  specialties: string[];
  tasksCompleted?: number;
  responseTime?: string;
}

export type ConversationStatus = 'active' | 'pending' | 'resolved' | 'archived';
export type ConversationPriority = 'high' | 'medium' | 'low';

export interface Conversation {
  id: string;
  title: string;
  participants: string[];
  agentId?: string;
  agentName?: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  channel: 'whatsapp' | 'telegram' | 'webchat' | 'email' | 'voice';
  clientId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: string;
  senderType: 'user' | 'agent' | 'client' | 'system';
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  actions?: MessageAction[];
}

export interface Attachment {
  id: string;
  name: string;
  type: 'document' | 'image' | 'audio' | 'link';
  url?: string;
  size?: string;
}

export interface MessageAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  assigneeType?: 'human' | 'agent';
  dueDate?: string;
  projectId?: string;
  projectName?: string;
  tags?: string[];
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  ref?: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  progress: number;
  tasksTotal: number;
  tasksDone: number;
  members: string[];
  dueDate?: string;
  color: string;
  budget?: number;
  clientId?: string;
  clientName?: string;
}

export type ClientStatus = 'active' | 'prospect' | 'churned' | 'onboarding';
export type DealStage = 'discovery' | 'proposal' | 'negotiation' | 'closing' | 'won' | 'lost';

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  status: ClientStatus;
  revenue?: number;
  lastContact?: string;
  assignedAgent?: string;
  tags?: string[];
  sector?: string;
  town?: string;
  countryCode?: string;
  notePublic?: string;
  notePrivate?: string;
  isSupplier?: boolean;
}

export interface Deal {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  stage: DealStage;
  value: number;
  probability: number;
  expectedClose?: string;
  assignee?: string;
}

export interface Activity {
  id: string;
  type: 'message' | 'task' | 'deal' | 'meeting' | 'alert' | 'agent' | 'system';
  title: string;
  description?: string;
  timestamp: string;
  icon?: string;
  actionUrl?: string;
  priority?: 'high' | 'medium' | 'low';
  clientId?: string;
  clientName?: string;
}

export interface Metric {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'stable';
  icon?: string;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'recommendation' | 'alert' | 'opportunity' | 'info';
  agentId?: string;
  agentName?: string;
  actionLabel?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
  active?: boolean;
}
