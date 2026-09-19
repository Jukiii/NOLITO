import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "docs/"] },
  js.configs.recommended,
  {
    files: ["public/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.browser,
    },
  },
  {
    files: ["*.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
];
