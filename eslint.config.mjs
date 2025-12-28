import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import ftFlow from "eslint-plugin-ft-flow";
import hermes from "hermes-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: compat.extends(
        "eslint:recommended",
        "plugin:ft-flow/recommended",
    ),

    languageOptions: {
        globals: {
            ...globals.browser,
            process: true,
        },

        ecmaVersion: 2021,
        sourceType: "module",
        parser: hermes,
    },

    plugins: {
        ftFlow
    },

    settings: {},

    rules: {
        indent: ["error", 4],

        quotes: ["warn", "double", {
            avoidEscape: true,
        }],

        "react/prop-types": "off",

        "no-plusplus": ["warn", {
            allowForLoopAfterthoughts: true,
        }],

        "import/prefer-default-export": "off",

        "no-unused-expressions": ["warn", {
            allowShortCircuit: false,
            allowTernary: false,
            allowTaggedTemplates: false,
        }],

        "no-unused-vars": "warn",

        "no-empty-function": ["warn", {
            allow: ["arrowFunctions", "functions", "methods"],
        }],
    },
}]);
