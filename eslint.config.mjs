import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      ".agents/**",
      ".claude/**",
      "skills/**",
      "design/**",
      // Vendored verbatim from React Bits (sources in design/design-src.txt).
      // Kept byte-identical on purpose so upstream diffs stay reviewable, so
      // this repo's stricter react-hooks rules are not enforced on them.
      "components/reactbits/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default eslintConfig;