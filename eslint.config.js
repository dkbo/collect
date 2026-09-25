import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'docs', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // 整包匯入 @babylonjs/core 會把整個引擎（約 6.4 MB）打進 vendor-babylon；一律走深層路徑（經 @/babylon/babylonCore）
      'no-restricted-imports': ['error', {
        paths: [{ name: '@babylonjs/core', message: '請改用深層路徑匯入（見 @/babylon/babylonCore），整包匯入會把整個 Babylon 引擎打進 bundle。' }],
      }],
      'no-restricted-syntax': ['error', {
        selector: "ImportExpression[source.value='@babylonjs/core']",
        message: '請改用深層路徑匯入（見 @/babylon/babylonCore），整包匯入會把整個 Babylon 引擎打進 bundle。',
      }],
    },
  },
])
