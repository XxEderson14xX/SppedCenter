## 2026-10-01 - DOM XSS in Quote Line Items Value Attribute
**Vulnerability:** Unescaped concept description variable `descripcionMostrar` inserted directly into HTML input `value` attribute inside `renderConceptos()`.
**Learning:** Even within single-page applications rendering dynamically constructed HTML template strings, dynamic value attributes can break out of attributes (`"`) if dynamic user content isn't passed through HTML attribute escaping functions like `escHtml()`.
**Prevention:** Always wrap template string substitutions inside HTML element attributes with `escHtml()`.
