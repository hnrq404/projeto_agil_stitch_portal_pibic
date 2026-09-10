---
name: Institutional Scientific Portal
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#44474e'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#485f83'
  primary: '#00142f'
  on-primary: '#ffffff'
  primary-container: '#0f294a'
  on-primary-container: '#7a91b7'
  inverse-primary: '#b0c8f1'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#240f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#422000'
  on-tertiary-container: '#d97705'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#b0c8f1'
  on-primary-fixed: '#001b3b'
  on-primary-fixed-variant: '#30476a'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4rem
  layout-margin-mobile: 1rem
  layout-margin-tablet: 1.5rem
  layout-margin-desktop: 2rem
  layout-gutter: 1.5rem
  layout-max-width: 1280px
---

## Brand & Style

This design system targets researchers, university faculty, scientific grant evaluators, and undergraduate research scholars (PIBIC/PIBITI). It embodies Brazilian federal academic rigor (inspired by CNPq, CAPES, and federal university research rectorates) merged with contemporary digital efficiency.

The visual style is **Corporate / Modern Institutional**:
- **Authoritative & Trustworthy**: Deep, structured indigo conveys institutional legitimacy and regulatory compliance without feeling dated or bureaucratic.
- **Scientific Clarity**: High information density balanced by rigorous whitespace, eliminating visual clutter in favor of scannable metadata, structured registries, and accessible document hierarchies.
- **Inclusive Accessibility**: Formulated strictly under WCAG 2.1 AA criteria, delivering high text-to-background contrast ratios and distinct, non-color-exclusive state signifiers.
- **Precise & Analytical**: Subtle geometric boundaries, crisp hairline dividers, tabular numeral alignments, and restrained accents indicate an analytical, data-centric research environment.

## Colors

The palette establishes an immediate institutional presence, pairing deep academic maritime hues with vibrant scientific teals and standard Brazilian public research state signifiers.

### Palette Breakdown
- **Primary Navy (`#0F294A` / `#1A365D`)**: Anchors primary navigation bars, dominant action buttons, table headers, and structural institution branding.
- **Secondary Teal (`#0D9488` / `#059669`)**: Highlights active grants, verified scientific outputs, publication confirmations, and primary progress indicators.
- **Tertiary Amber (`#D97706`)**: Denotes evaluation milestones, draft statuses ("Em Análise"), pending committee reviews, and notice alerts.
- **Neutral Dark (`#0F172A`)**: Primary text color for body paragraphs, labels, and titles, ensuring a contrast ratio exceeding 12:1 against light canvases.
- **Neutral Surface & Canvas (`#F8FAFC`, `#FFFFFF`, `#F1F5F9`)**: Canvas backgrounds, layered data card fills, and neutral input fields.
- **Semantic Status Signals**:
  - **Ativa / Aberta / Aprovada**: `#10B981` (Emerald) surface tint `#ECFDF5`, border `#A7F3D0`
  - **Em Análise / Pendente**: `#D97706` (Amber) surface tint `#FFFBEB`, border `#FDE68A`
  - **Finalizada / Concluída**: `#64748B` (Slate) surface tint `#F8FAFC`, border `#E2E8F0`
  - **Recusada / Cancelada**: `#EF4444` (Rose) surface tint `#FEF2F2`, border `#FECACA`

## Typography

Typography establishes an unambiguous visual order between institutional governance and detailed academic cataloging.

- **Headlines & Section Titles (`Plus Jakarta Sans`)**: Delivers an approachable modern character while maintaining architectural authority in grant announcements, platform headers, and metric titles.
- **Body & Tabular Data (`Inter`)**: Chosen for high micro-legibility at small sizes, optical neutrality, and native support for tabular numerals (`tnum`), essential for project budgets, CNPq grant IDs, CPF/matricula records, and evaluation scorecards.
- **Identifier & Process Labels (`JetBrains Mono`)**: Reserved for process registration keys (e.g., `23076.014821/2024-11`), DOI strings, and ORCID links.

## Layout & Spacing

The layout is built on a responsive 12-column grid centered within a maximum width of `1280px` (`layout-max-width`), anchored by a strict 8px base rhythm.

### Grid & Responsiveness
- **Desktop (>= 1024px)**: 12-column grid, `layout-margin-desktop` (32px), `layout-gutter` (24px). Accommodates persistent left navigation (260px) alongside dual-pane evaluation boards and 3-column metric grids.
- **Tablet (768px - 1023px)**: 8-column grid, `layout-margin-tablet` (24px), `layout-gutter` (16px). Left navigation collapses into an off-canvas drawer; multi-step forms collapse side summaries below active inputs.
- **Mobile (< 768px)**: 4-column grid, `layout-margin-mobile` (16px), `layout-gutter` (12px). Data tables collapse into stacked metadata record cards with horizontal scroll for numeric tables.

## Elevation & Depth

This system avoids floating, hyper-stylized neomorphic or vaporous glass designs. Visual hierarchy relies on **crisp structural containment, hairline slate borders, and low-opacity institutional shadows**.

- **Level 0 (Flat / Canvas)**: `#F8FAFC`. Background for pages, dashboards, and evaluation panels.
- **Level 1 (Card / Table Layer)**: `#FFFFFF`, bounded by `1px solid #E2E8F0`. Subtle resting shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.05)`. Used for KPI metrics, list items, and form groups.
- **Level 2 (Active Focus / Interactive Cards)**: `#FFFFFF`, border shifts to `#CBD5E1`. Elevated shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`. Used for project cards on hover, active accordion blocks, and dropdown menus.
- **Level 3 (Overlays & Dialogs)**: `#FFFFFF`, border `1px solid #94A3B8`. Strong directional shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)`. Applied to triage modal sheets, criteria scoring drawers, and confirmation dialogues.

## Shapes

The design uses a restrained, professional roundedness level (`roundedness: 1`).
- **Base (0.25rem / 4px)**: Checkboxes, table column indicators, tag chips, and file preview snippets.
- **Medium / Large (0.5rem / 8px)**: Form fields, metric stat tiles, research summary cards, action buttons, and dropdown containers.
- **Extra-Large (0.75rem / 12px)**: Outer structural panels, modals, and file dropzones.
- **Full Pill (`rounded-full`)**: Strictly restricted to status badges and quick-filter toggle pills to differentiate them immediately from interactive rectangular controls.

## Components

### Buttons
- **Primary**: Solid Deep Navy (`#0F294A`), text white, font-weight 600. Height 40px (desktop), 8px corner radius. Focus ring: 3px `#93C5FD`.
- **Secondary**: Outlined hairline border `#CBD5E1`, surface white, text `#0F294A`. Hover background `#F8FAFC`.
- **Success / Action**: Solid Emerald Teal (`#0D9488`), text white. Reserved for final grant submission, approval sign-off, or export actions.

### Academic Search Bars & Quick-Filter Pills
- Single unified search input with integrated search icon, clear button, and shortcut badge (`⌘K`).
- Filter bar sits directly beneath the search input: a horizontal track of pill badges with active/inactive states (e.g., "Todos", "Edital 2024/2025", "Bolsas PIBIC", "Voluntários PIVIC"). Inactive pills use `#F1F5F9` background and `#475569` text; active pills use `#0F294A` background with `#FFFFFF` text.

### Research Summary Cards
- White surface, `1px solid #E2E8F0`, 8px padding/radius.
- **Header**: Project registration code (`JetBrains Mono`, 12px), title (`Plus Jakarta Sans` 16px semibold), right-aligned status badge pill.
- **Body**: Advisor name, department code (e.g., `DCC / ICEx`), and student scholarship holder.
- **Footer**: CNPq subarea tag, quota indicator, and contextual action link ("Ver Parecer", "Submeter Relatório").

### Metric KPI Stat Tiles
- Compact white container with an accent top-border strip (2px height) in Primary Navy or Secondary Teal.
- Displays large tabular numeric stat (28px bold), labeled by a clean 12px uppercase title, paired with a delta comparison indicator or total quota tally (e.g., `14/20 Bolsas Alocadas`).

### Multi-Step Research Registration Forms
- **Stepper Header**: Sequential track with numeric circular steps. Finished steps display a check icon with `#0D9488` fill; current step displays a navy border and bold label.
- **Input Fields**: 40px height, `1px solid #CBD5E1` border, `#FFFFFF` surface, font size 14px. Float label pattern avoided in favor of clear top-aligned labels with explicit asterisks for mandatory CNPq/Lattes fields.
- **Attachment Dropzones**: Dashed border `2px dashed #94A3B8`, background `#F8FAFC`. Contains centered document upload icon, upload prompt text, allowed format badges (`PDF até 10MB`), and real-time upload progress bars.

### Application Triage Review Panels
- Dual-column layout: left pane for PDF preview/project workplan summary; right pane for criterion-by-criterion scoring rubric.
- Scoring inputs utilize segmented numerical radio buttons (0 to 10 scale) paired with mandatory reviewer justification textareas.