// import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";


export default [
  // pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.js", "build/**", "base_code.js"],
  },
  { languageOptions: { globals: globals.browser } },
];
