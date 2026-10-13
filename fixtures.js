/* Synthetic HTML shaped like each store's result page. These test OUR parsing logic;
   they are not captured from the live sites. */

const amz = ({ asin, title, price, mrp, rating = '4.5', count = '1,234', sponsored = false, delivery = true, img = 'x' }) => `
<div data-asin="${asin}" data-component-type="s-search-result" class="s-result-item">
  ${sponsored ? '<span class="puis-sponsored-label-text">Sponsored</span>' : ''}
  <img class="s-image" alt="" src="https://m.media-amazon.com/images/I/${img}.jpg">
  <h2 aria-label="${title}" class="a-size-medium"><span>${title}</span></h2>
  <span class="a-icon-alt">${rating} out of 5 stars</span>
  <a aria-label="${count} ratings" href="#customerReviews"><span class="a-size-base s-underline-text">${count}</span></a>
  ${price ? `<span class="a-price" data-a-size="xl"><span class="a-offscreen">${price}</span><span aria-hidden="true">x</span></span>` : ''}
  ${mrp ? `<span class="a-price a-text-price" data-a-strike="true"><span class="a-offscreen">${mrp}</span></span>` : ''}
  ${delivery ? '<div data-cy="delivery-recipe"><div><span>FREE delivery</span> <span>Tue, 14 Oct</span></div></div>' : ''}
</div>`;

export const AMAZON_HTML = `<html><body><div id="search">
${amz({ asin: 'B0DGHYWX01', title: 'Apple iPhone 16 Pro 128 GB: 5G Mobile Phone with Camera Control, 4K 120 fps Dolby Vision and a Huge Leap in Battery Life. Works with AirPods; Black Titanium', price: '₹1,19,900', mrp: '₹1,29,900', count: '1,234' })}
${amz({ asin: 'B0DGHYWX02', title: 'Apple iPhone 16 Pro 256 GB: 5G Mobile Phone with Camera Control; Natural Titanium', price: '₹1,29,900', mrp: '₹1,39,900', count: '2.5K', img: 'y' })}
${amz({ asin: 'B0DGHYWX03', title: 'Apple iPhone 16 Plus 128 GB: 5G Mobile Phone', price: '₹89,900', mrp: '₹89,900' })}
${amz({ asin: 'B0AD000001', title: 'Sponsored phone case for iPhone', price: '₹299', sponsored: true })}
${amz({ asin: 'B0NOPRICE1', title: 'Currently unavailable iPhone', price: null })}
${amz({ asin: 'B0DGHYWX01', title: 'Duplicate ASIN', price: '₹1,00,000' })}
</div><footer>nav</footer></body></html>`;

export const AMAZON_CAPTCHA = '<html><body>Enter the characters you see below<form></form></body></html>';

const fk = ({ id, slug, title, price, mrp, extra = '', rating = '4.6', ratings = '1,23,456', ad = false }) => `
<div data-id="${id}"><div>
  <a class="CGtC98" href="/${slug}/p/itm${id.toLowerCase()}?pid=${id}&amp;lid=LSTX&amp;marketplace=FLIPKART&amp;q=iphone&amp;srno=s_1_1&amp;otracker=search" target="_blank" rel="noopener noreferrer">
    <div><img loading="eager" class="DByuf4" alt="${title}" src="https://rukminim2.flixcart.com/image/312/312/${id}.jpeg?q=70"></div>
    <div>
      <div class="KzDlHZ">${title}</div>
      <div><span><div class="XQDdHH">${rating}</div></span><span class="Wphh3N"><span><span>${ratings}&nbsp;Ratings&nbsp;&amp;&nbsp;12,345&nbsp;Reviews</span></span></span></div>
      <ul><li>128 GB ROM</li><li>15.49 cm (6.1 inch) Display</li><li>48MP Rear Camera</li></ul>
    </div>
    <div>
      <div class="Nx9bqj _4b5DiR">${price}</div>
      ${mrp ? `<div class="yRaY8j ZYYwLA">${mrp}</div><div class="UkUFwK"><span>9% off</span></div>` : ''}
      <div>Free delivery</div>
      <div>Upto ₹2,000 Off on Exchange</div>
      ${ad ? '<div>Ad</div>' : ''}
      ${extra}
    </div>
  </a></div></div>`;

export const FLIPKART_HTML = `<html><body><div class="results">
${fk({ id: 'MOBH4DQFG8NJRZCV', slug: 'apple-iphone-16-pro-black-titanium-128-gb', title: 'Apple iPhone 16 Pro (Black Titanium, 128 GB)', price: '₹1,17,900', mrp: '₹1,29,900' })}
${fk({ id: 'MOBH4DQFG8NJRZC2', slug: 'apple-iphone-16-pro-natural-titanium-256-gb', title: 'Apple iPhone 16 Pro (Natural Titanium, 256 GB)', price: '₹1,27,900', mrp: '₹1,39,900', ratings: '9,876' })}
${fk({ id: 'MOBH4DQFG8NJRZC3', slug: 'apple-iphone-16-plus-black-128-gb', title: 'Apple iPhone 16 Plus (Black, 128 GB)', price: '₹87,900' })}
${fk({ id: 'MOBADVERT0000001', slug: 'sponsored', title: 'Sponsored Phone X', price: '₹9,999', ad: true })}
</div></body></html>`;

export const YT_HTML = `<html><script>var ytInitialData = ${JSON.stringify({
  contents: { a: { b: [
    { videoRenderer: { videoId: 'abc123DEF45', title: { runs: [{ text: 'iPhone 16 Pro Review' }] }, ownerText: { runs: [{ text: 'TechChannel' }] }, thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/abc123DEF45/default.jpg' }, { url: 'https://i.ytimg.com/vi/abc123DEF45/hq.jpg' }] }, lengthText: { simpleText: '12:04' } } },
    { videoRenderer: { videoId: 'live0000000', title: { simpleText: 'LIVE now' }, ownerText: { runs: [{ text: 'X' }] } } },
    { videoRenderer: { videoId: 'xyz789GHI01', title: { runs: [{ text: 'Should you buy it?' }] }, ownerText: { runs: [{ text: 'Reviewer' }] }, lengthText: { simpleText: '8:30' } } },
  ] } },
})};</script></html>`;
