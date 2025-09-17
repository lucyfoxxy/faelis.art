# Styles – Projektstruktur

Dieses Projekt verwendet ein **5-Layer CSS Setup**.  
Die Reihenfolge ist wichtig und wird in `layout.astro` bereits korrekt eingebunden.

---

## Layer

### 1. `tokens.css`
- Globale Design-Tokens: Farben, Abstände, Radius, Shadow, Blur, Fonts.
- Nur Variablen (`--foo`), **keine Klassen**.

### 2. `base.css`
- CSS Reset und Baseline (Box-Sizing, Body-Setup, Hintergrund, Media Defaults).
- Enthält auch Fokus- und Motion-Reduction-Regeln.

### 3. `typography.css`
- Schriftdefinitionen, Headings, Absätze, Listen, Blockquotes.
- Greift nur innerhalb von `.panel`, damit Panels eine eigene Typo haben.

### 4. `site.css`
- Layout & Struktur: Header, Footer, Container, Panels, Navigation.
- Ziel: das **Gerüst der Seite**.

### 5. `content.css`
- Inhaltliche Komponenten & Widgets: Hero, Contact-Buttons, Gallery, Fae-Viewer.
- Ziel: wiederverwendbare Module, die im Container/Panel platziert werden.

---

## Einbindung

```astro
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/typography.css';
import '../styles/site.css';
import '../styles/content.css';
