const roomFilmCatalog = [
  { name: 'Ho Chi Minh Film Lab', city: 'Ho Chi Minh City', aliases: ['ho chi minh', 'hcm', 'sai gon', 'saigon'], address: 'Ho Chi Minh City, Vietnam', imageUrl: '/Room-Flim/01_Ho_Chi_Minh_Film_Lab.png' },
  { name: 'Tay Ninh Film Room', city: 'Tay Ninh', aliases: ['tay ninh'], address: 'Tay Ninh, Vietnam', imageUrl: '/Room-Flim/02_Tay_Ninh_Film_Room.png' },
  { name: 'Ha Noi Film Lab', city: 'Ha Noi', aliases: ['ha noi', 'hanoi'], address: 'Ha Noi, Vietnam', imageUrl: '/Room-Flim/03_Ha_Noi_Film_Lab.png' },
  { name: 'Vung Tau Film Studio', city: 'Vung Tau', aliases: ['vung tau'], address: 'Vung Tau, Ba Ria - Vung Tau, Vietnam', imageUrl: '/Room-Flim/04_Vung_Tau_Film_Studio.png' },
  { name: 'Da Lat Film House', city: 'Da Lat', aliases: ['da lat', 'dalat'], address: 'Da Lat, Lam Dong, Vietnam', imageUrl: '/Room-Flim/05_Da_Lat_Film_House.png' },
];

function normalizeText(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
}

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function buildProjectCatalogAnswer(question, cameras = []) {
  const normalizedQuestion = normalizeText(question);
  const asksHighestPrice = /(gia tri cao|dat nhat|gia cao nhat|cao tien nhat|most expensive|highest priced|highest price)/.test(normalizedQuestion);
  const category = /(may anh|camera|cameras)/.test(normalizedQuestion)
    ? 'Cameras'
    : /(ong kinh|lens|lenses)/.test(normalizedQuestion)
      ? 'Lenses'
      : /(phim|film)/.test(normalizedQuestion)
        ? 'Film'
        : null;
  if (asksHighestPrice && category) {
    const highestPricedItem = cameras
      .filter((item) => !item.category || item.category === category)
      .filter((item) => Number.isFinite(Number(item.price)) && Number(item.price) > 0)
      .sort((a, b) => Number(b.price) - Number(a.price))[0];
    if (!highestPricedItem) {
      return { answer: `Hiện website chưa có dữ liệu giá ${category === 'Cameras' ? 'máy ảnh' : category === 'Lenses' ? 'ống kính' : 'mục Film'} hợp lệ để xác định sản phẩm đắt nhất.`, source: 'website-catalog' };
    }
    return {
      answer: `Theo danh mục ${category} hiện có trên website, ${highestPricedItem.title} đang có giá niêm yết cao nhất: ${formatUsd(highestPricedItem.price)}. Đây là giá catalog, không phải định giá thị trường hoặc giá trị sưu tầm.`,
      source: 'website-catalog',
      items: [{ title: highestPricedItem.title, price: Number(highestPricedItem.price), currency: highestPricedItem.currency || 'USD', imageUrl: highestPricedItem.imageUrl || null }],
    };
  }

  const asksFilmRecommendation = /(best film|which film|film is best|film stock|loai phim|cuon phim|phim nao.*(hay nhat|tot nhat|phu hop|nen chon|nen dung|chup)|phim chup)/.test(normalizedQuestion);
  if (asksFilmRecommendation) {
    return {
      answer: 'Nếu bạn muốn một lựa chọn đa dụng, Kodak Portra 400 là gợi ý cân bằng cho chân dung, du lịch và ánh sáng ban ngày. Chụp thiếu sáng có thể cân nhắc Portra 800; phong cảnh màu rực hơn hợp với Kodak Ektar 100 hoặc Fujifilm Velvia 50; ảnh đen trắng có thể chọn Ilford HP5 Plus. “Tốt nhất” còn tùy thể loại ảnh và gu màu. Lưu ý: đây là gợi ý kiến thức, không khẳng định các cuộn phim này đang được bán trong catalog Marketplace hiện tại.',
      source: 'photography-knowledge',
    };
  }

  return null;
}

function getRoomFilmCatalog() {
  return roomFilmCatalog;
}

function buildLocalRecommendation({ labs = [], location = {}, price = {}, preferences = {} }) {
  const { city, country } = location;
  const { minPrice, maxPrice } = price;
  const { serviceType, filmStyle, budget } = preferences;

  const scoredLabs = labs.map((lab) => {
    let score = 0;
    if (city && lab.city?.toLowerCase() === city.toLowerCase()) score += 40;
    if (country && lab.country?.toLowerCase() === country.toLowerCase()) score += 20;
    if (lab.rating >= 4.5) score += 20;
    if (serviceType) {
      const matchesService = lab.services?.some((service) => service.serviceType?.toLowerCase().includes(serviceType.toLowerCase()));
      if (matchesService) score += 25;
      const packageMatch = lab.packages?.some((pkg) => pkg.title?.toLowerCase().includes(serviceType.toLowerCase()) || pkg.description?.toLowerCase().includes(serviceType.toLowerCase()));
      if (packageMatch) score += 15;
    }
    if (minPrice || maxPrice) {
      const packagePrices = lab.packages?.map((pkg) => pkg.price) || [];
      if (packagePrices.length) {
        const avg = packagePrices.reduce((sum, price) => sum + price, 0) / packagePrices.length;
        if (minPrice && avg >= minPrice) score += 10;
        if (maxPrice && avg <= maxPrice) score += 10;
      }
    }
    if (budget) {
      const priceMatch = (lab.packages || []).some((pkg) => Number(pkg.price) <= Number(budget));
      if (priceMatch) score += 10;
    }
    return { lab, score };
  });

  scoredLabs.sort((a, b) => b.score - a.score);
  const bestLabEntry = scoredLabs[0] || null;
  const bestLab = bestLabEntry?.lab || null;
  const chosenPackage = (bestLab?.packages || []).slice().sort((a, b) => Number(a.price) - Number(b.price))[0] || null;

  return {
    source: 'local-recommendation',
    recommendations: {
      filmLab: bestLab
        ? {
            id: bestLab.id,
            name: bestLab.name,
            city: bestLab.city,
            country: bestLab.country,
            rating: bestLab.rating,
            priceRange: bestLab.priceRange,
            serviceQuality: bestLab.serviceQuality,
            photoUrl: bestLab.photoUrl,
          }
        : null,
      package: chosenPackage
        ? {
            id: chosenPackage.id,
            title: chosenPackage.title,
            description: chosenPackage.description,
            price: chosenPackage.price,
          }
        : null,
      filmType: filmStyle || 'Portra 400',
    },
  };
}

function buildLocalRagAnswer(question, labs = []) {
  const lower = normalizeText(question);
  const requestedRoom = roomFilmCatalog.find((room) => room.aliases.some((alias) => lower.includes(alias)));
  if (requestedRoom) {
    const matchingLabs = labs
      .filter((lab) => normalizeText(lab.city).includes(normalizeText(requestedRoom.city)))
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    const bestLab = matchingLabs[0];
    const labText = bestLab
      ? ` Lab có dữ liệu đánh giá cao nhất tại khu vực này là ${bestLab.name} (${Number(bestLab.rating || 0).toFixed(1)}/5), địa chỉ ${bestLab.address}.`
      : '';
    return `Tại ${requestedRoom.city}, địa điểm trong danh mục Film Lab là ${requestedRoom.name}, địa chỉ khu vực ${requestedRoom.address}.${labText} Hiện hệ thống chưa có đủ dữ liệu đánh giá và địa chỉ chi tiết để khẳng định đây là nơi tốt nhất; bạn có thể xem ảnh và thông tin cập nhật trong Marketplace.`;
  }
  if (lower.includes('portrait') || lower.includes('portra')) {
    return 'For portraits, Kodak Portra 400 is a safe and versatile choice because it gives soft skin tones and fine grain. If you want a more vibrant look, Portra 800 is also strong for low-light scenes.';
  }
  if (lower.includes('black') || lower.includes('bw')) {
    return 'For black-and-white photography, Ilford HP5 Plus and Kodak Tri-X 400 are great choices. They offer strong contrast and are very forgiving in low light.';
  }
  if (lower.includes('landscape')) {
    return 'For landscapes, Fujifilm Velvia 50 or Kodak Ektar 100 are excellent. They offer rich color saturation and fine detail.';
  }
  return 'A good starting point is to match your film stock to your scene: choose Portra for portraits, Velvia for landscapes, and HP5 or Tri-X for street and documentary photography.';
}

module.exports = { buildLocalRecommendation, buildLocalRagAnswer, buildProjectCatalogAnswer, getRoomFilmCatalog };