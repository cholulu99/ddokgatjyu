// Freesound CC0 효과음 미리듣기 파일을 같은 주소로 중계하고 Vercel CDN에 오래 캐시한다.
const ALLOW = new Set(['737/737271_13999124', '478/478934_4638708', '458/458645_6996390', '12/12730_2211', '680/680735_14831112', '435/435508_1196020', '607/607226_887696', '172/172712_3223402', '546/546479_11588763', '269/269571_4564240', '560/560692_10936067', '233/233151_4056007', '240/240139_729251', '397/397317_3366726', '398/398933_909016', '240/240372_3763935', '504/504654_3923096', '213/213232_1038806', '161/161122_2750714', '170/170808_377731', '237/237984_4082826']);
module.exports = async (req, res) => {
  const p = String((req.query && req.query.p) || '');
  const m = p.match(/^(\d+\/\d+_\d+)-hq\.mp3$/);
  if (!m || !ALLOW.has(m[1])) { res.statusCode = 404; return res.end('not found'); }
  try {
    const r = await fetch('https://cdn.freesound.org/previews/' + p);
    if (!r.ok) { res.statusCode = 502; return res.end('upstream ' + r.status); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(buf);
  } catch (e) { res.statusCode = 502; res.end('error'); }
};
