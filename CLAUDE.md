# Akhil Srivatsan — Personal Website

## What this is

A personal website for Akhil Srivatsan — writer, musician, bassist in a band called Ravens, founder of growth consultancy Milk Toast, based in Dubai, from Mumbai. The site is a single home for all his creative work, replacing two previous sites: stranger-fiction.com (Squarespace, music/art/culture magazine) and akhilsrivatsan.com (Substack, personal essays).

## Design philosophy

The site is modelled after darioamodei.com — plain, text-forward, almost document-like. The work is the interface. No hero images, no blog roll, no magazine layout, no decoration. Closer to an index or a personal knowledge base than a blog. Other reference points: scaruffi.com, qntm.org.

The design principle is: the absence of design. Content gets its personality from the writing, not from the presentation.

## Typography and styling

- **Font**: Inter (loaded from Google Fonts). Chosen because it gets out of the way. On a site this plain, Inter works — it's not trying to be expressive.
- **Base size**: 15px
- **Color**: Near-black text (#1a1a1a) on near-white background (#fafafa). Muted elements in #888. Links are same color as text with thin underline.
- **Layout**: Single column, max-width 600px, centered. Generous top/bottom padding.
- **Section headers on directory pages**: Small, uppercase, muted — they organize without shouting.

## Structure

The landing page (index.html) has:
1. "Akhil Srivatsan" as the title
2. One-line intro: "Writer, musician, international Mumbaikar."
3. Five plain links — Fiction, Music, Essays, Reviews, Journal
4. Footer with email link

Each link leads to its own directory page listing all work in that category.

### Fiction (fiction.html)
- **After Forever**: A 7-part serialised sci-fi novelette (Jun 2023 – Jun 2024). Has a short description.
- **Stories**: Standalone short fiction pieces.

### Music (music.html)
- **Releases**: Original music releases (2020–2022).
- **Sonic Pi experiments**: Coding-music explorations.

### Essays (essays.html)
- Personal essays, originally from Substack. Currently only 6 posts are listed — Substack blocked automated scraping so Akhil needs to add the rest manually.

### Reviews (reviews.html)
- **Music**: Album reviews/essays (these are not conventional reviews — each uses an album as a lens for personal/philosophical exploration). 20 entries from The Music Box on Stranger Fiction.
- **Cinema & TV**: 8 film/TV pieces.
- **New Media**: 6 pieces on games, interactive media, Sonic Pi, AI Dungeon, etc.

### Journal (journal.html)
- Empty placeholder. "Nothing here yet." Will be used later when Akhil is comfortable writing directly into the site the way he writes into docs.

## Content links

Currently all content links point to the original Squarespace (stranger-fiction.com) and Substack (akhilsrivatsan.com) URLs. Over time, content will be migrated to live directly on this site.

## Key context for making changes

- Akhil is allergic to corporate tone, content calendars, SEO thinking, and anything that feels like the hustle-culture internet. Don't add anything that smells like that.
- The site should stay as simple as possible. No build step, no framework, no CMS. Adding a new piece means adding a `<li>` line to the relevant HTML file.
- Don't add features unless asked. No analytics, no comments, no social sharing buttons, no "related posts."
- The "reviews" are not conventional reviews. They're essays that use a specific encounter (an album, a film) as a lens for larger personal and philosophical examination. Don't recategorize or rename them in ways that flatten this.
- The Sonic Pi experiments are filed under Music (not Reviews) because they're Akhil's own creative work, not commentary on someone else's.

## Future considerations (not to implement now)

- RSS feed for newsletter delivery (via Buttondown or similar service that turns RSS into emails)
- Migrating content from Squarespace/Substack to live directly on this site
- Hosting on Netlify or GitHub Pages with stranger-fiction.com or akhilsrivatsan.com pointed at it
- BCN_KUL_DXB — a completed autofictional novel that needs to find readers. May eventually have a presence on the site.

## Files

```
index.html      — Landing page
fiction.html    — Fiction directory
music.html      — Music directory
essays.html     — Essays directory
reviews.html    — Reviews directory
journal.html    — Journal (empty)
style.css       — Shared stylesheet
```
