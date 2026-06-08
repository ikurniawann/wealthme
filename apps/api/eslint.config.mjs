import base from "@wealthme/config/eslint";
import globals from "globals";

export default [
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
