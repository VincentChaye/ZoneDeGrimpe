import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { MapPage } from '@/pages/MapPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { MySpotsPage } from '@/pages/MySpotsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { FriendsPage } from '@/pages/FriendsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LogbookPage } from '@/pages/LogbookPage';
import { FeedPage } from '@/pages/FeedPage';
import { AdminSpotsPage } from '@/pages/AdminSpotsPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { AdminGearPage } from '@/pages/AdminGearPage';
import { MyProfilePage } from '@/pages/MyProfilePage';
import { MessagesPage } from '@/pages/MessagesPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { useMessagesStore } from '@/stores/messages.store';
import { connectSocket, disconnectSocket } from '@/lib/socket';

function App() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const { token, isAuthenticated } = useAuthStore();
  const { loadConversations, _onNewMessage, _onConversationUpdated, _onUserStatus, _onTyping } =
    useMessagesStore();

  useEffect(() => {
    hydrateAuth();
    hydrateTheme();
  }, [hydrateAuth, hydrateTheme]);

  // Connect / disconnect Socket.io with auth
  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket();
      return;
    }
    const socket = connectSocket(token);
    loadConversations();

    socket.on('new_message', _onNewMessage);
    socket.on('conversation_updated', _onConversationUpdated);
    socket.on('user_status', _onUserStatus);
    socket.on('typing', _onTyping);

    return () => {
      socket.off('new_message', _onNewMessage);
      socket.off('conversation_updated', _onConversationUpdated);
      socket.off('user_status', _onUserStatus);
      socket.off('typing', _onTyping);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  return (
    <BrowserRouter basename="/ZoneDeGrimpe">
      <Toaster position="bottom-center" richColors closeButton />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/my-spots" element={<MySpotsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/me" element={<MyProfilePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/logbook" element={<LogbookPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/admin/spots" element={<AdminSpotsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/gear" element={<AdminGearPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
