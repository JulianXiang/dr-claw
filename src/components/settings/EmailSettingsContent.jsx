import { useEffect, useState } from 'react';
import { Key, Mail } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { api, authenticatedFetch } from '../../utils/api';

export default function EmailSettingsContent() {
  const [notificationEmail, setNotificationEmail] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [maskedResendKey, setMaskedResendKey] = useState('');
  const [profileStatus, setProfileStatus] = useState(null);
  const [senderStatus, setSenderStatus] = useState(null);
  const [resendStatus, setResendStatus] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingSender, setIsSavingSender] = useState(false);
  const [isSavingResendKey, setIsSavingResendKey] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const [profileRes, senderRes, resendRes] = await Promise.all([
          authenticatedFetch('/api/user/profile'),
          api.settings.autoResearchEmail(),
          api.settings.autoResearchResendKey(),
        ]);

        const profileData = await profileRes.json();
        const senderData = await senderRes.json();
        const resendData = await resendRes.json();

        if (!cancelled && profileRes.ok) {
          setNotificationEmail(profileData?.profile?.notificationEmail || '');
        }
        if (!cancelled && senderRes.ok) {
          setSenderEmail(senderData?.senderEmail || '');
        }
        if (!cancelled && resendRes.ok) {
          setMaskedResendKey(resendData?.maskedKey || '');
        }
      } catch (err) {
        if (!cancelled) {
          setProfileStatus({ success: false, message: err.message || 'Failed to load email settings' });
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setProfileStatus(null);
    try {
      const res = await authenticatedFetch('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ notificationEmail: notificationEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotificationEmail(data?.profile?.notificationEmail || notificationEmail.trim());
        setProfileStatus({ success: true, message: 'Notification email saved.' });
      } else {
        setProfileStatus({ success: false, message: data.error || 'Failed to save notification email' });
      }
    } catch (err) {
      setProfileStatus({ success: false, message: err.message || 'Failed to save notification email' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveSenderEmail = async () => {
    setIsSavingSender(true);
    setSenderStatus(null);
    try {
      const res = await api.settings.updateAutoResearchEmail(senderEmail.trim());
      const data = await res.json();
      if (res.ok) {
        setSenderEmail(data?.senderEmail || senderEmail.trim());
        setSenderStatus({ success: true, message: 'Sender email saved.' });
      } else {
        setSenderStatus({ success: false, message: data.error || 'Failed to save sender email' });
      }
    } catch (err) {
      setSenderStatus({ success: false, message: err.message || 'Failed to save sender email' });
    } finally {
      setIsSavingSender(false);
    }
  };

  const handleSaveResendKey = async () => {
    setIsSavingResendKey(true);
    setResendStatus(null);
    try {
      const res = await api.settings.updateAutoResearchResendKey(resendApiKey.trim());
      const data = await res.json();
      if (res.ok) {
        setMaskedResendKey(data?.maskedKey || '');
        setResendApiKey('');
        setResendStatus({ success: true, message: 'Resend API key saved.' });
      } else {
        setResendStatus({ success: false, message: data.error || 'Failed to save Resend API key' });
      }
    } catch (err) {
      setResendStatus({ success: false, message: err.message || 'Failed to save Resend API key' });
    } finally {
      setIsSavingResendKey(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Email Notifications</h3>
        <p className="text-sm text-muted-foreground">
          Configure recipient, sender, and delivery settings for Auto Research email notifications.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-gray-500" />
          <div className="font-medium text-foreground">Notification Email</div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Recipient Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
            />
            <div className="mt-1 text-xs text-muted-foreground">
              Auto Research requires a saved recipient email before execution can start.
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={isSavingProfile || !notificationEmail.trim()} size="sm" variant="outline">
            {isSavingProfile ? 'Saving...' : 'Save Notification Email'}
          </Button>
          {profileStatus && (
            <div className={`text-sm ${profileStatus.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {profileStatus.message}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-gray-500" />
          <div className="font-medium text-foreground">Sender Email</div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">From Address</label>
            <Input
              type="email"
              placeholder="noreply@example.com"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
            />
            <div className="mt-1 text-xs text-muted-foreground">
              This is the sender address used by Auto Research completion emails.
            </div>
          </div>
          <Button onClick={handleSaveSenderEmail} disabled={isSavingSender || !senderEmail.trim()} size="sm" variant="outline">
            {isSavingSender ? 'Saving...' : 'Save Sender Email'}
          </Button>
          {senderStatus && (
            <div className={`text-sm ${senderStatus.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {senderStatus.message}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-gray-500" />
          <div className="font-medium text-foreground">Resend API Key</div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Delivery Key</label>
            <Input
              type="password"
              placeholder="re_..."
              value={resendApiKey}
              onChange={(e) => setResendApiKey(e.target.value)}
            />
            <div className="mt-1 text-xs text-muted-foreground">
              This key is used by the app to send Auto Research completion emails through Resend.
            </div>
            {maskedResendKey ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Current key: {maskedResendKey}
              </div>
            ) : null}
          </div>
          <Button onClick={handleSaveResendKey} disabled={isSavingResendKey || !resendApiKey.trim()} size="sm" variant="outline">
            {isSavingResendKey ? 'Saving...' : 'Save Resend API Key'}
          </Button>
          {resendStatus && (
            <div className={`text-sm ${resendStatus.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {resendStatus.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
