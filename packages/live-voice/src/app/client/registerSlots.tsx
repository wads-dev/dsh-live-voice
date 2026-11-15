import React from 'react';
import { withAppLanguage } from './i18n/index.js';
import { CLIENT_SLOT_DEFINITIONS, SETTINGS_SLOT } from './slotDefinitions.js';

type SlotComponents = Record<string, React.ComponentType<any>>;
export function LiveVoiceSettingsIcon({ size = 20 }: { size?: number; active?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5M6 10v2a6 6 0 0 0 12 0v-2M12 18v4M8 22h8M3 8v6M21 8v6" />
    </svg>
  );
}
export function registerSettingsSlot(
  ctx: any,
  component: React.ComponentType<any>,
  label: () => string,
) {
  return [
    ctx.slots.inject(SETTINGS_SLOT.name, () =>
      ctx.slots.register({ ...SETTINGS_SLOT, label }, withAppLanguage(component, ctx.locale)),
    ),
    ctx.slots.inject('settings.section.icon', () =>
      ctx.slots.register(
        { name: 'settings.section.icon', id: SETTINGS_SLOT.id },
        LiveVoiceSettingsIcon,
      ),
    ),
  ];
}
export function registerConversationSlots(
  ctx: any,
  components: SlotComponents,
  label: () => string,
) {
  return CLIENT_SLOT_DEFINITIONS.map((definition) => {
    const component = components[definition.component];
    if (!component) throw new Error(`Missing slot component: ${definition.component}`);
    return ctx.slots.inject(definition.name, () =>
      ctx.slots.register(
        { name: definition.name, id: definition.id, order: definition.order, label },
        withAppLanguage(component, ctx.locale),
      ),
    );
  });
}
