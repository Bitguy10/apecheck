import { View, Text, Pressable, Linking } from 'react-native';
import type { SocialsInfo } from '@apecheck/core';
import { formatNumber, formatAge } from '@apecheck/core';

function TrustBadge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) {
    return (
      <View className="rounded bg-panel px-1.5 py-0.5">
        <Text className="font-mono text-[10px] text-text-muted">{label}?</Text>
      </View>
    );
  }
  return (
    <View className={`rounded px-1.5 py-0.5 ${ok ? 'bg-signal-green/10' : 'bg-rug-red/10'}`}>
      <Text className={`font-mono text-[10px] ${ok ? 'text-signal-green' : 'text-rug-red'}`}>
        {ok ? '✓' : '✗'} {label}
      </Text>
    </View>
  );
}

function Row({
  icon,
  title,
  href,
  children,
  border,
}: {
  icon: string;
  title: string;
  href: string | null;
  children?: React.ReactNode;
  border?: boolean;
}) {
  const body = (
    <View className={`flex-row items-center justify-between gap-2 px-4 py-3 ${border ? 'border-t border-border/40' : ''}`}>
      <View className="flex-1 flex-row items-center gap-2">
        <Text>{icon}</Text>
        <Text className={`flex-1 text-sm ${href ? 'text-solana-purple' : 'text-text-muted'}`} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center justify-end gap-1">{children}</View>
    </View>
  );
  if (!href) return body;
  return (
    <Pressable onPress={() => Linking.openURL(href)} className="active:opacity-70">
      {body}
    </Pressable>
  );
}

/** Socials & legitimacy panel with trust badges and red-flag states. */
export function SocialsPanel({ socials }: { socials: SocialsInfo }) {
  const { website, x, telegram, domainMismatch, allMissing } = socials;

  return (
    <View className="overflow-hidden rounded-lg border border-border bg-panel/60">
      <View className="flex-row items-center justify-between border-b border-border/60 px-4 py-2">
        <Text className="font-mono text-[11px] uppercase tracking-widest text-signal-green">{'> '}socials & legitimacy</Text>
        {domainMismatch && (
          <View className="rounded bg-rug-red/10 px-1.5 py-0.5">
            <Text className="font-mono text-[10px] text-rug-red">⚠ domain mismatch</Text>
          </View>
        )}
      </View>

      {allMissing ? (
        <View className="px-4 py-6">
          <Text className="text-center text-sm font-semibold text-rug-red">🚩 No socials found at all</Text>
          <Text className="mt-1 text-center text-xs text-text-secondary">
            Legit projects almost always have a site, X, or Telegram. Treat this as a major red flag.
          </Text>
        </View>
      ) : (
        <View>
          <Row icon="🌐" title={website.url || 'No website'} href={website.url}>
            {website.url && (
              <TrustBadge
                ok={website.domainAgeDays == null ? null : website.domainAgeDays > 30}
                label={website.domainAgeDays != null ? `domain ${formatAge(website.domainAgeDays * 24)}` : 'age'}
              />
            )}
          </Row>
          <Row icon="𝕏" title={x.handle ? `@${x.handle}` : x.url || 'No X account'} href={x.url} border>
            {x.followers != null && <TrustBadge ok={x.followers > 500} label={`${formatNumber(x.followers)} followers`} />}
            {x.accountAgeDays != null && <TrustBadge ok={x.accountAgeDays > 30} label={`${formatAge(x.accountAgeDays * 24)} old`} />}
          </Row>
          <Row icon="✈️" title={telegram.url ? 'Telegram group' : 'No Telegram'} href={telegram.url} border>
            {telegram.memberCount != null && <TrustBadge ok={telegram.memberCount > 500} label={`${formatNumber(telegram.memberCount)} members`} />}
            {telegram.url && telegram.memberCount == null && <TrustBadge ok={telegram.isPublic} label={telegram.isPublic ? 'public' : 'private'} />}
          </Row>
        </View>
      )}
    </View>
  );
}
