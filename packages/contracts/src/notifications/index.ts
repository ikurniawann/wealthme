export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  icon: string | null;
  isRead: boolean;
  createdAt: string;
}
