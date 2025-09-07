// pages/api/generate.js
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;
      const prompt = fields.prompt;
      const imagePath = files.image.path;

      // read file as buffer
      const imageBuffer = fs.readFileSync(imagePath);

      // TODO: replace with Nano Banana endpoint & request format from docs
      const NANO_BANANA_ENDPOINT = process.env.NANO_BANANA_ENDPOINT || 'https://api.nano-banana.example/generate';
      const NANO_BANANA_KEY = process.env.NANO_BANANA_KEY || '';

      // Example of uploading — actual API will differ; we'll adapt to docs you provide
      const apiResponse = await fetch(NANO_BANANA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NANO_BANANA_KEY}`,
          // other headers per doc (content-type / multipart etc.)
        },
        body: (() => {
          const fd = new FormData();
          fd.append('prompt', prompt);
          fd.append('image', new Blob([imageBuffer]), files.image.name);
          return fd;
        })()
      });

      const data = await apiResponse.json();
      // Expect data.output_url or adapt per real docs
      if (!apiResponse.ok) return res.status(500).json({ error: data?.error || 'API failed' });
      return res.status(200).json({ output_url: data.output_url || data.result_url || null, meta: data });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  });
}