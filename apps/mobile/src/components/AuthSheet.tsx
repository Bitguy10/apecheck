import { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { C } from '../lib/theme';

type Mode = 'signin' | 'signup';

/**
 * Email + password auth. Shown as a modal sheet. Instant login — the Supabase
 * project has "Confirm email" disabled, so a successful sign-up returns a session
 * immediately and we drop the user straight in.
 */
export function AuthSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode('signin');
    setEmail('');
    setPassword('');
    setError(null);
    setLoading(false);
  }

  async function submit() {
    if (!email.includes('@')) return setError('Enter a valid email.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true);
    setError(null);
    const { error } = mode === 'signup' ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    setLoading(false);
    if (error) setError(error);
    else {
      reset();
      onClose();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="rounded-t-2xl border-t border-border bg-panel p-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-display text-lg font-bold text-text-primary">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-text-muted">✕</Text>
            </Pressable>
          </View>

          <View className="mb-4 flex-row rounded-lg border border-border bg-jungle-black p-1">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 items-center rounded-md py-1.5 ${mode === m ? 'bg-signal-green/15' : ''}`}
              >
                <Text className={`font-mono text-[11px] uppercase tracking-wider ${mode === m ? 'text-signal-green' : 'text-text-muted'}`}>
                  {m === 'signin' ? 'sign in' : 'sign up'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="degen@wallet.sol"
            placeholderTextColor={C['text-muted']}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            className="rounded-lg border border-border bg-jungle-black px-3 py-3 font-mono text-sm text-text-primary"
          />

          <Text className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={C['text-muted']}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            className="rounded-lg border border-border bg-jungle-black px-3 py-3 font-mono text-sm text-text-primary"
          />

          <Pressable
            onPress={submit}
            disabled={loading}
            className="mt-4 items-center rounded-lg bg-solana-purple py-3 active:opacity-90 disabled:opacity-60"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-display font-bold text-white">{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
            )}
          </Pressable>

          {error && <Text className="mt-3 text-center text-xs text-rug-red">{error}</Text>}

          <Text className="mt-3 text-center font-mono text-[10px] text-text-muted">
            instant access · no email confirmation needed
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
