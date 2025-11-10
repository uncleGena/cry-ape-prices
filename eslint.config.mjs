import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactPlugin from "eslint-plugin-react";
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: {
      react: reactPlugin,
    },
    rules: {
      quotes: ["error", "double", { avoidEscape: true }],
      "no-multiple-empty-lines": ["error", { max: 0, maxEOF: 0, maxBOF: 0 }],
      indent: ["error", 2, { SwitchCase: 1, ignoredNodes: ["JSXElement *", "JSXElement"] }],
      "react/jsx-indent": ["error", 2],
      "react/jsx-indent-props": ["error", 2],
    },
  },
]);

export default eslintConfig;
