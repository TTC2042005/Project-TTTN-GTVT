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

function buildLocalRagAnswer(question) {
  const lower = question.toLowerCase();
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

module.exports = { buildLocalRecommendation, buildLocalRagAnswer };