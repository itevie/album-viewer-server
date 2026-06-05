export interface MetaTags {
  // Basic HTML
  title?: string;
  description?: string;
  keywords?: string[];
  author?: string;
  robots?: string;
  canonical?: string;

  // Open Graph
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogUrl?: string;
  ogType?: string;
  ogSiteName?: string;
  ogLocale?: string;

  // Misc
  themeColor?: string;
  favicon?: string;
  manifest?: string;

  // Custom tags
  custom?: Record<string, string>;
}

const defaults: MetaTags = {
  title: "Album Viewer",
  description: "A simple photo album viewer",
  keywords: ["album", "viewer", "photos", "images"],
};

export function makeMeta(meta: MetaTags): string {
  const completed = { ...defaults, ...meta };

  let tags = "";

  for (const [key, value] of Object.entries(completed)) {
    if (value === undefined) continue;

    if (key === "title") {
      tags += `<title>${value}</title>\n`;
    } else if (key === "description") {
      tags += `<meta name="description" content="${value}">\n`;
    } else if (key === "keywords") {
      tags += `<meta name="keywords" content="${(value as string[]).join(", ")}">\n`;
    } else if (key === "author") {
      tags += `<meta name="author" content="${value}">\n`;
    } else if (key === "robots") {
      tags += `<meta name="robots" content="${value}">\n`;
    } else if (key === "canonical") {
      tags += `<link rel="canonical" href="${value}">\n`;
    } else if (key.startsWith("og")) {
      const ogKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      tags += `<meta property="og:${ogKey}" content="${value}">\n`;
    } else if (key === "themeColor") {
      tags += `<meta name="theme-color" content="${value}">\n`;
    } else if (key === "favicon") {
      tags += `<link rel="icon" href="${value}">\n`;
    } else if (key === "manifest") {
      tags += `<link rel="manifest" href="${value}">\n`;
    } else if (key === "custom") {
      for (const [customKey, customValue] of Object.entries(value)) {
        tags += `<meta name="${customKey}" content="${customValue}">\n`;
      }
    }
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      ${tags}
    </head>
    <body>
      <div id="app"></div>
    </body>
    </html>
  `;
}

export function handleBots(req: any, res: any, meta: MetaTags) {
  const userAgent = req.headers["user-agent"] || "";

  // Simple bot detection (can be improved with a library like "isbot")
  const isBot =
    /bot|crawler|spider|crawling|discord/i.test(userAgent) ||
    req.query["_escaped_fragment_"] !== undefined;

  if (isBot) {
    res.send(makeMeta(meta));
    return true;
  }

  return false;
}
