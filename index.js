const express = require('express');
const { JSDOM } = require('jsdom');
const request = require('request');
const queryString = require('query-string');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || '3000';

function propertiesUrl(queryObj) {
  console.log(queryString.stringify(queryObj));
  return 'https://mls.realt.by/flats/list/?' + queryString.stringify(queryObj);
}

function fetchList(params, form) {
  var headers = {
    'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:75.0) Gecko/20100101 Firefox/75.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://mls.realt.by',
    'Connection': 'keep-alive',
    'Referer': 'https://mls.realt.by/flats/list/?sort=date_reception%3Aasc&s[rooms][e][]=1&s[rooms][e][]=2&s[rooms][e][]=3&s[house_number][range]=4&s[area_total][ge]=0&s[area_total][le]=1000&s[building_year][ge]=1950&s[building_year][le]=2020&s[house_type][e][]=%D0%BC&s[house_type][e][]=%D0%BA%D0%B1&s[layout][e][]=%D1%83%D0%BB%2F%D0%BF%D1%80&s[layout][e][]=%D1%81%D1%82%D0%B0%D0%BB.&s[repair_state][e][]=%D0%B5%D0%B2%D1%80%D0%BE&s[repair_state][e][]=%D0%BE%D1%82%D0%BB.',
    'Upgrade-Insecure-Requests': '1',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Cookie': `mls_region_id=${params.region}; mls_sub_region_id=${params.region}; realt_user=e056883cf1d884bbc0e6298ca61d017e`
  };

  var dataString = `logintype=login&pid=69&permalogin=1&user=${process.env.USER_LOGIN}&pass=${process.env.USER_PASS}`;

  var options = {
    url: propertiesUrl(form),
    method: 'POST',
    headers: headers,
    body: dataString
  };

  return new Promise((resolve, reject) => {
    request(options, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        // console.log(body);
        resolve(body);
        return;
      }
      reject();
    });
  });
}

function clean(obj) {
  for (var propName in obj) {
    if (obj[propName] === null || obj[propName] === undefined) {
      delete obj[propName];
    }
  }
}

function getFormData(params) {
  const example = {
    // район города
    district: '#10',
    // площадь
    area: 50,
    // дом построен с
    buildingYearStart: 1950,
    // дом построен по
    buildingYearEnd: 2020,
    // комнат: 1, 2, 3, 4, 5 (значит 5+)
    rooms: 2,
    // материал стен [ "п", "м", "к", "б", "кб", "сб", "бр" ]
    houseType: 'м',
    // тип дома [ "ул/пр", "стал.", "чешка", "ст/пр", "бреж.", "хрущ.", "м/с", "своб.", "студия", "п/хаус", "т/хаус" ]
    layout: 'стал.',
    // состояние ремонта [ "евро", "отл.", "хор.", "норм.", "удовл.", "плох.", "авар", "б/отд", "стр/отд" ]
    repairState: 'евро'
  };
  const p = {
    's[town_subdistrict_id][e][]': params.district,
    's[area_total][ge]': +params.area - 5,
    's[area_total][le]': +params.area + 5,
    's[building_year][ge]': params.buildingYearStart,
    's[building_year][le]': params.buildingYearEnd,
    's[rooms][e][]': params.rooms,
    's[price][ge]': 1,
    's[price_m2][ge]': 1,
    's[house_type][e][]': params.material,
    's[repair_state][e][]': params.repair,
    // 's[repair_state][e][]': {
    //   // 'off': [],
    //   'all': ["евро", "отл.", "хор.", "норм.", "удовл.", "плох.", "авар", "б/отд", "стр/отд"],
    //   'отл.': ['отл.', 'хор.']
    // }[params.repair],
  };
  clean(p);
  return p;
}

function parseMinSummaryPrice(params) {
  const form = getFormData(params);
  return fetchList(params, { 'sort': 'price:asc', ...form }).then(html => {
    const dom = new JSDOM(html);
    console.log(dom.window.document.querySelectorAll('.price'));
    const priceStr = ([].filter.call(
      dom.window.document.querySelectorAll('.price span.alert'),
      span => span.innerHTML
    )[0] || {}).innerHTML;
    return parseFloat(priceStr);
  });
}

function parseMaxSummaryPrice(params) {
  const form = getFormData(params);
  return fetchList(params, { 'sort': 'price:desc', ...form }).then(html => {
    const dom = new JSDOM(html);
    const priceStr = ([].filter.call(
      dom.window.document.querySelectorAll('.price span.alert'),
      span => span.innerHTML
    )[0] || {}).innerHTML;
    return parseFloat(priceStr);
  });
}

function parseMinSquarePrice(params) {
  const form = getFormData(params);
  return fetchList(params, { 'sort': 'price_m2:asc', ...form }).then(html => {
    const dom = new JSDOM(html);
    const priceStr = ([].filter.call(
      dom.window.document.querySelectorAll('.price-metr'),
      span => span.innerHTML
    )[0] || {}).innerHTML;
    return parseFloat(priceStr && priceStr.substring(0, priceStr.length - 1));
  });
}

function parseMaxSquarePrice(params) {
  const form = getFormData(params);
  return fetchList(params, { 'sort': 'price_m2:desc', ...form }).then(html => {
    const dom = new JSDOM(html);
    const priceStr = ([].filter.call(
      dom.window.document.querySelectorAll('.price-metr'),
      span => span.innerHTML
    )[0] || {}).innerHTML;
    return parseFloat(priceStr && priceStr.substring(0, priceStr.length - 1));
  });
}

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => res.send('Hello World!'));

app.post('/calcProperty', (req, res) => {
  const params = req.body;
  console.log(params);
  Promise.all([
    parseMinSummaryPrice(params),
    parseMaxSummaryPrice(params),
    parseMinSquarePrice(params),
    parseMaxSquarePrice(params)
  ]).then(arr => {
    console.log("That's all ((");
    console.log(arr);
    res.send({
      minPrice: arr[0],
      maxPrice: arr[1],
      minPriceM2: arr[2],
      maxPriceM2: arr[3]
    });
  });
});

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
