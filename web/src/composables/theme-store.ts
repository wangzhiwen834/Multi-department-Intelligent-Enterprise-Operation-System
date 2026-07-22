// 全局主题单例(light/dark)。localStorage 记忆;模块加载即 apply,减少首帧闪烁。
import { ref } from 'vue';

export type ThemeKey = 'light' | 'dark';
const KEY = 'theme';

const theme = ref<ThemeKey>((localStorage.getItem(KEY) as ThemeKey) === 'dark' ? 'dark' : 'light');

const apply = (k: ThemeKey) => {
  document.documentElement.dataset.theme = k;
  localStorage.setItem(KEY, k);
};
apply(theme.value); // 模块加载即应用(在 App mount 前)

export const useTheme = () => ({
  theme,
  toggle: () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    apply(theme.value);
  },
});
