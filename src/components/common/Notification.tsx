import React from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
}

interface Props {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
}

export const NotificationContainer: React.FC<Props> = ({ notifications, onDismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none">
      {notifications.map(n => (
        <div
          key={n.id}
          className="pointer-events-auto flex items-center bg-gray-900 border border-gray-700 shadow-2xl rounded-lg p-3 w-80 animate-in slide-in-from-right fade-in duration-300"
        >
          <div className="mr-3">
            {n.type === 'success' && <CheckCircle className="text-emerald-500" size={20} />}
            {n.type === 'error' && <AlertCircle className="text-red-500" size={20} />}
            {n.type === 'warning' && <AlertCircle className="text-yellow-500" size={20} />}
            {n.type === 'info' && <Info className="text-blue-500" size={20} />}
          </div>
          <div className="flex-1 text-sm text-gray-200 break-words">{n.message}</div>
          <button
            onClick={() => onDismiss(n.id)}
            className="ml-2 text-gray-500 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};