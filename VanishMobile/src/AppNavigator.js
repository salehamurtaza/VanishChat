
// All navigation lives here: Splash → Join → Chat ⇄ Settings
// Settings/Chat → Join on leave

import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import useRelay from './hooks/useRelay';
import { loadProfile, saveProfile } from './storage';
import SplashScreen from './screens/SplashScreen';
import JoinScreen from './screens/JoinScreen';
import ChatScreen from './screens/ChatScreen';
import SettingsScreen from './screens/SettingsScreen';

const SPLASH_MS = 2200;

export default function AppNavigator() {
  const [screen, setScreen] = useState('splash');
  const [profile, setProfile] = useState(null);
  const relay = useRelay();

  const save = (p) => {
    setProfile(p);
    saveProfile(p);
  };

  // 1. Splash → Always Join when the app starts
  useEffect(() => {
    let mounted = true;

    (async () => {
      const [p] = await Promise.all([
        loadProfile(),
        new Promise((resolve) => setTimeout(resolve, SPLASH_MS)),
      ]);

      if (!mounted) return;

      console.log('PROFILE CHECK:', {
        deviceIdExists: typeof p.deviceId === 'string',
        deviceIdValid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.deviceId || ''),
        profileKeys: Object.keys(p),
      });

      setProfile(p);
      setScreen('join');
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // 2. Join → Chat when the relay accepts the connection
  useEffect(() => {
    if (screen === 'join' && relay.status === 'connected' && profile) {
      save({ ...profile, joined: true });
      setScreen('chat');
    }
  }, [relay.status, screen]);

  // 3. Android back button: Settings → Chat
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'settings') {
        setScreen('chat');
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [screen]);

  const leave = () => {
    relay.disconnect(true);
    save({ ...profile, joined: false });
    setScreen('join');
  };

  if (screen === 'splash' || !profile) {
    return <SplashScreen />;
  }

  if (screen === 'join') {
    return (
      <JoinScreen
        profile={profile}
        relay={relay}
        onConnect={(p) => {
          save({ ...p, joined: false });
          relay.connect(p);
        }}
        onCancel={() => relay.disconnect()}
      />
    );
  }

  if (screen === 'settings') {
    return (
      <SettingsScreen
        profile={profile}
        relay={relay}
        onBack={() => setScreen('chat')}
        onSaveName={(name) => {
          const p = { ...profile, name };
          save(p);
          relay.connect(p);
        }}
        onReconnect={relay.reconnect}
        onLeave={leave}
      />
    );
  }

  return (
    <ChatScreen
      profile={profile}
      relay={relay}
      onSettings={() => setScreen('settings')}
      onChangeDetails={leave}
    />
  );
}
