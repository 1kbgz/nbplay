/** Mount `<tag>` with props and collect bubbling events on `window.__events`. */
export async function mount(
  page,
  tag,
  props = {},
  events = ["input", "change"],
) {
  await page.evaluate(
    async ({ tag, props, events }) => {
      await window.__components;
      const el = document.createElement(tag);
      const { style, ...rest } = props;
      if (style) el.setAttribute("style", style);
      Object.assign(el, rest);
      window.__events = [];
      for (const name of events) {
        el.addEventListener(name, (e) =>
          window.__events.push([name, e.detail]),
        );
      }
      document.getElementById("root").appendChild(el);
      await el.updateComplete;
      await Promise.all(
        [...el.querySelectorAll("*")]
          .map((c) => c.updateComplete)
          .filter(Boolean),
      );
    },
    { tag, props, events },
  );
}

export const events = (page) => page.evaluate(() => window.__events);

export const clearEvents = (page) =>
  page.evaluate(() => {
    window.__events = [];
  });
