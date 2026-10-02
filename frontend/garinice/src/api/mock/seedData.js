// Static reference data for the demo environment. All names, dealers and people are fictional.

export const BODY_TYPES = [
  { slug: 'suv', name: 'SUV', plural: 'SUVs', description: 'SUVs dominate Kenyan roads for good reason: high ground clearance for rough rural roads and flooded city streets, room for the whole family, and strong resale value. Popular picks include the Toyota Prado, Harrier, Nissan X-Trail, Mazda CX-5 and Subaru Forester.' },
  { slug: 'saloon', name: 'Saloon', plural: 'Saloons', description: 'Saloons offer a comfortable ride, a secure boot and lower running costs than most SUVs. Toyota Axio, Premio, Mark X and Mercedes-Benz C-Class models are perennial favourites with Kenyan buyers.' },
  { slug: 'hatchback', name: 'Hatchback', plural: 'Hatchbacks', description: 'Compact, fuel-efficient and easy to park, hatchbacks are ideal for city commuting in Nairobi traffic. The Toyota Vitz, Mazda Demio, Honda Fit and Volkswagen Golf are top choices for first-time buyers.' },
  { slug: 'station-wagon', name: 'Station Wagon', plural: 'Station Wagons', description: 'Station wagons combine saloon-like driving with extra cargo space — perfect for families and small businesses. The Toyota Fielder, Subaru Outback and Probox are some of the most practical cars in Kenya.' },
  { slug: 'pickup-truck', name: 'Pickup/Truck', plural: 'Pickups & Trucks', description: 'From farm work to construction sites, pickups are the workhorses of the Kenyan economy. The Toyota Hilux, Isuzu D-Max, Ford Ranger and Nissan Navara are known for durability and strong resale.' },
  { slug: 'van-bus', name: 'Van/Bus', plural: 'Vans & Buses', description: 'Vans and minibuses carry families, staff and goods. The Toyota Noah, Voxy and Hiace and the Nissan Caravan are widely used for both personal and commercial transport.' },
  { slug: 'sports-car', name: 'Sports Car', plural: 'Sports Cars', description: 'Performance-focused coupes and saloons for enthusiasts. Expect higher insurance and running costs, so budget for these when comparing models such as the Subaru WRX STI or BMW M4.' },
  { slug: 'other', name: 'Other', plural: 'Other vehicles', description: 'Convertibles, coupes and specialist vehicles that do not fit the main categories.' },
]

export const FUEL_TYPES = [
  { slug: 'petrol', name: 'Petrol' },
  { slug: 'diesel', name: 'Diesel' },
  { slug: 'hybrid', name: 'Hybrid' },
  { slug: 'electric', name: 'Electric' },
]

export const TRANSMISSIONS = [
  { slug: 'automatic', name: 'Automatic' },
  { slug: 'manual', name: 'Manual' },
]

export const LOCATIONS = [
  { slug: 'nairobi', name: 'Nairobi', county: 'Nairobi', major: true },
  { slug: 'mombasa', name: 'Mombasa', county: 'Mombasa', major: true },
  { slug: 'kisumu', name: 'Kisumu', county: 'Kisumu', major: true },
  { slug: 'nakuru', name: 'Nakuru', county: 'Nakuru', major: true },
  { slug: 'eldoret', name: 'Eldoret', county: 'Uasin Gishu', major: true },
  { slug: 'thika', name: 'Thika', county: 'Kiambu', major: false },
  { slug: 'kiambu', name: 'Kiambu', county: 'Kiambu', major: false },
  { slug: 'machakos', name: 'Machakos', county: 'Machakos', major: false },
  { slug: 'kitengela', name: 'Kitengela', county: 'Kajiado', major: false },
  { slug: 'nyeri', name: 'Nyeri', county: 'Nyeri', major: false },
  { slug: 'naivasha', name: 'Naivasha', county: 'Nakuru', major: false },
  { slug: 'meru', name: 'Meru', county: 'Meru', major: false },
  { slug: 'kakamega', name: 'Kakamega', county: 'Kakamega', major: false },
  { slug: 'malindi', name: 'Malindi', county: 'Kilifi', major: false },
  { slug: 'kitale', name: 'Kitale', county: 'Trans Nzoia', major: false },
]

export const COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado',
  'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu',
  'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi', 'Nakuru',
  'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River',
  'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
]

export const FEATURES = [
  // safety
  ['abs', 'ABS', 'safety'], ['brake-assist', 'Brake assist', 'safety'], ['lane-assist', 'Lane keep assist', 'safety'],
  ['central-locking', 'Central locking', 'safety'], ['reverse-camera', 'Reverse camera', 'safety'],
  ['parking-sensors', 'Parking sensors', 'safety'], ['traction-control', 'Traction control', 'safety'],
  ['hill-start-assist', 'Hill start assist', 'safety'], ['blind-spot', 'Blind spot monitor', 'safety'],
  ['adaptive-cruise', 'Adaptive cruise control', 'safety'], ['immobiliser', 'Immobiliser', 'safety'],
  // interior
  ['leather-seats', 'Leather seats', 'interior'], ['sunroof', 'Sunroof', 'interior'], ['climate-control', 'Climate control', 'interior'],
  ['heated-seats', 'Heated seats', 'interior'], ['power-seats', 'Power seats', 'interior'], ['third-row', 'Third-row seating', 'interior'],
  ['air-conditioning', 'Air conditioning', 'interior'], ['multi-function-wheel', 'Multi-function steering', 'interior'],
  // exterior
  ['alloy-wheels', 'Alloy wheels', 'exterior'], ['roof-rails', 'Roof rails', 'exterior'], ['led-headlights', 'LED headlights', 'exterior'],
  ['fog-lights', 'Fog lights', 'exterior'], ['tow-bar', 'Tow bar', 'exterior'], ['power-tailgate', 'Power tailgate', 'exterior'],
  ['side-steps', 'Side steps', 'exterior'],
  // technology
  ['navigation', 'Navigation', 'technology'], ['bluetooth', 'Bluetooth', 'technology'], ['apple-carplay', 'Apple CarPlay', 'technology'],
  ['android-auto', 'Android Auto', 'technology'], ['keyless-entry', 'Keyless entry', 'technology'], ['push-start', 'Push start', 'technology'],
  ['cruise-control', 'Cruise control', 'technology'], ['camera-360', '360° camera', 'technology'], ['usb', 'USB / AUX', 'technology'],
]

// [model, bodySlug, engines[], fuels[], [minPrice, maxPrice] (for newest year), [minYear, maxYear], drive, seats, variants[]]
export const BRANDS = [
  { name: 'Toyota', popular: true, weight: 34, country: 'Japan', models: [
    ['Land Cruiser Prado', 'suv', [2700, 2800], ['petrol', 'diesel'], [6_500_000, 12_500_000], [2010, 2024], '4WD', 7, ['TX', 'TX-L', 'VX']],
    ['Land Cruiser', 'suv', [4500, 4600], ['diesel', 'petrol'], [11_000_000, 26_000_000], [2010, 2023], '4WD', 8, ['V8', 'ZX', 'GX']],
    ['Harrier', 'suv', [2000, 2500], ['petrol', 'hybrid'], [3_300_000, 6_200_000], [2014, 2023], 'AWD', 5, ['Premium', 'Elegance', 'Progress']],
    ['RAV4', 'suv', [2000, 2500], ['petrol', 'hybrid'], [3_000_000, 5_600_000], [2013, 2023], 'AWD', 5, ['G', 'Adventure', 'X']],
    ['Hilux', 'pickup-truck', [2400, 2800], ['diesel'], [4_200_000, 7_200_000], [2012, 2024], '4WD', 5, ['Double Cab', 'Single Cab', 'Revo']],
    ['Axio', 'saloon', [1500], ['petrol', 'hybrid'], [1_650_000, 2_400_000], [2012, 2021], '2WD', 5, ['G', 'X', 'Hybrid']],
    ['Fielder', 'station-wagon', [1500], ['petrol', 'hybrid'], [1_550_000, 2_300_000], [2012, 2021], '2WD', 5, ['G', 'X', 'Hybrid WxB']],
    ['Vitz', 'hatchback', [1000, 1300], ['petrol'], [950_000, 1_450_000], [2011, 2020], '2WD', 5, ['F', 'Jewela', 'RS']],
    ['Mark X', 'saloon', [2500], ['petrol'], [2_200_000, 3_300_000], [2010, 2019], '2WD', 5, ['250G', 'Premium']],
    ['Probox', 'station-wagon', [1500], ['petrol'], [950_000, 1_450_000], [2012, 2021], '2WD', 5, ['DX', 'GL']],
    ['Noah', 'van-bus', [2000], ['petrol', 'hybrid'], [2_100_000, 3_200_000], [2014, 2022], '2WD', 8, ['Si', 'X', 'G']],
    ['Crown', 'saloon', [2500, 3500], ['petrol', 'hybrid'], [3_000_000, 5_000_000], [2013, 2022], '2WD', 5, ['Athlete', 'Royal Saloon']],
    ['Hiace', 'van-bus', [2800], ['diesel'], [3_500_000, 6_200_000], [2012, 2023], '2WD', 14, ['Commuter', 'Super GL']],
  ] },
  { name: 'Nissan', popular: true, weight: 10, country: 'Japan', models: [
    ['X-Trail', 'suv', [2000, 2500], ['petrol', 'hybrid'], [2_400_000, 4_200_000], [2013, 2022], 'AWD', 7, ['20X', 'Mode Premier']],
    ['Note', 'hatchback', [1200], ['petrol', 'hybrid'], [950_000, 1_600_000], [2013, 2021], '2WD', 5, ['e-Power', 'X', 'Medalist']],
    ['Navara', 'pickup-truck', [2500], ['diesel'], [3_300_000, 5_600_000], [2012, 2023], '4WD', 5, ['Double Cab', 'NP300']],
    ['Juke', 'suv', [1500], ['petrol'], [1_400_000, 2_300_000], [2012, 2019], '2WD', 5, ['15RX', 'Premium']],
    ['Sylphy', 'saloon', [1800], ['petrol'], [1_250_000, 1_950_000], [2012, 2020], '2WD', 5, ['G', 'S']],
    ['Caravan', 'van-bus', [2500], ['diesel'], [2_300_000, 4_100_000], [2012, 2022], '2WD', 10, ['NV350', 'Premium GX']],
    ['Patrol', 'suv', [5600], ['petrol'], [8_000_000, 15_000_000], [2012, 2022], '4WD', 8, ['LE', 'Platinum']],
  ] },
  { name: 'Mazda', popular: true, weight: 9, country: 'Japan', models: [
    ['CX-5', 'suv', [2000, 2200], ['petrol', 'diesel'], [2_900_000, 5_100_000], [2013, 2023], 'AWD', 5, ['XD', 'L Package', '20S']],
    ['Demio', 'hatchback', [1300, 1500], ['petrol', 'diesel'], [950_000, 1_600_000], [2012, 2020], '2WD', 5, ['13S', 'XD Touring']],
    ['Axela', 'hatchback', [1500, 2000], ['petrol'], [1_400_000, 2_100_000], [2013, 2019], '2WD', 5, ['15S', 'Sport']],
    ['Atenza', 'saloon', [2000, 2500], ['petrol', 'diesel'], [1_900_000, 3_100_000], [2013, 2020], '2WD', 5, ['20S', 'XD']],
    ['CX-3', 'suv', [1500, 1800], ['diesel', 'petrol'], [1_900_000, 2_800_000], [2015, 2021], '2WD', 5, ['XD Touring', '20S']],
    ['BT-50', 'pickup-truck', [2200, 3200], ['diesel'], [3_000_000, 5_200_000], [2012, 2022], '4WD', 5, ['Double Cab']],
  ] },
  { name: 'Subaru', popular: true, weight: 7, country: 'Japan', models: [
    ['Forester', 'suv', [2000], ['petrol'], [2_300_000, 4_600_000], [2012, 2022], 'AWD', 5, ['XT', '2.0i-L', 'Advance']],
    ['Outback', 'station-wagon', [2500], ['petrol'], [2_800_000, 5_000_000], [2013, 2022], 'AWD', 5, ['Limited', 'X-Break']],
    ['Impreza', 'hatchback', [1600, 2000], ['petrol'], [1_300_000, 2_300_000], [2012, 2020], 'AWD', 5, ['Sport', 'G4']],
    ['Legacy', 'station-wagon', [2000, 2500], ['petrol'], [1_500_000, 2_600_000], [2012, 2019], 'AWD', 5, ['B4', 'GT']],
    ['WRX STI', 'sports-car', [2500], ['petrol'], [4_000_000, 6_400_000], [2014, 2021], 'AWD', 5, ['Type S']],
    ['XV', 'suv', [1600, 2000], ['petrol', 'hybrid'], [1_900_000, 3_300_000], [2013, 2021], 'AWD', 5, ['Advance', '2.0i-S']],
  ] },
  { name: 'Mercedes-Benz', popular: true, weight: 6, country: 'Germany', aliases: ['mercedes', 'benz', 'merc'], models: [
    ['C200', 'saloon', [2000], ['petrol'], [3_200_000, 6_200_000], [2014, 2023], '2WD', 5, ['AMG Line', 'Avantgarde']],
    ['E250', 'saloon', [2000], ['petrol'], [4_200_000, 8_500_000], [2014, 2022], '2WD', 5, ['AMG Line', 'Exclusive']],
    ['GLE 350d', 'suv', [3000], ['diesel'], [8_500_000, 15_500_000], [2016, 2023], 'AWD', 5, ['4MATIC', 'AMG Line']],
    ['ML 350', 'suv', [3500], ['petrol', 'diesel'], [3_200_000, 6_200_000], [2012, 2016], 'AWD', 5, ['BlueTEC']],
    ['A180', 'hatchback', [1600], ['petrol'], [2_300_000, 3_600_000], [2014, 2021], '2WD', 5, ['Style', 'AMG Line']],
    ['G63 AMG', 'suv', [4000], ['petrol'], [26_000_000, 42_000_000], [2016, 2023], '4WD', 5, ['Edition']],
  ] },
  { name: 'BMW', popular: true, weight: 4, country: 'Germany', models: [
    ['320i', 'saloon', [2000], ['petrol'], [2_800_000, 5_200_000], [2013, 2022], '2WD', 5, ['M Sport', 'Luxury']],
    ['X5', 'suv', [3000], ['diesel', 'petrol'], [5_500_000, 12_500_000], [2013, 2023], 'AWD', 5, ['xDrive30d', 'M Sport']],
    ['X3', 'suv', [2000], ['diesel', 'petrol'], [3_800_000, 7_200_000], [2014, 2022], 'AWD', 5, ['xDrive20d', 'M Sport']],
    ['520d', 'saloon', [2000], ['diesel'], [3_600_000, 6_800_000], [2014, 2021], '2WD', 5, ['M Sport']],
    ['M4', 'sports-car', [3000], ['petrol'], [9_500_000, 14_500_000], [2015, 2022], '2WD', 4, ['Competition']],
    ['X1', 'suv', [2000], ['petrol'], [2_600_000, 4_600_000], [2014, 2021], 'AWD', 5, ['sDrive18i', 'xLine']],
  ] },
  { name: 'Honda', popular: true, weight: 5, country: 'Japan', models: [
    ['Fit', 'hatchback', [1300, 1500], ['petrol', 'hybrid'], [950_000, 1_700_000], [2013, 2021], '2WD', 5, ['13G', 'Hybrid F']],
    ['CR-V', 'suv', [2000, 2400], ['petrol'], [2_600_000, 4_600_000], [2013, 2022], 'AWD', 5, ['EX', 'Masterpiece']],
    ['Vezel', 'suv', [1500], ['hybrid', 'petrol'], [2_000_000, 3_300_000], [2014, 2022], '2WD', 5, ['Z', 'Hybrid RS']],
    ['Civic', 'saloon', [1500, 1800], ['petrol'], [1_800_000, 3_100_000], [2013, 2022], '2WD', 5, ['EX', 'Type R']],
  ] },
  { name: 'Lexus', popular: true, weight: 3, country: 'Japan', models: [
    ['RX 450h', 'suv', [3500], ['hybrid'], [5_200_000, 10_500_000], [2013, 2023], 'AWD', 5, ['F Sport', 'Version L']],
    ['LX 570', 'suv', [5700], ['petrol'], [12_000_000, 25_000_000], [2013, 2021], '4WD', 8, ['Sport']],
    ['NX 300', 'suv', [2000], ['petrol', 'hybrid'], [4_400_000, 7_200_000], [2015, 2022], 'AWD', 5, ['F Sport', 'I Package']],
    ['IS 250', 'saloon', [2500], ['petrol'], [2_000_000, 3_400_000], [2012, 2017], '2WD', 5, ['Version L']],
  ] },
  { name: 'Volkswagen', popular: false, weight: 4, country: 'Germany', aliases: ['vw'], models: [
    ['Golf', 'hatchback', [1400, 2000], ['petrol'], [1_700_000, 3_500_000], [2013, 2022], '2WD', 5, ['TSI', 'GTI', 'Highline']],
    ['Tiguan', 'suv', [2000], ['petrol', 'diesel'], [2_700_000, 5_100_000], [2013, 2022], 'AWD', 5, ['Allspace', 'R-Line']],
    ['Polo', 'hatchback', [1200, 1400], ['petrol'], [1_100_000, 2_100_000], [2013, 2022], '2WD', 5, ['TSI Comfortline']],
    ['Touareg', 'suv', [3000], ['diesel'], [4_200_000, 9_200_000], [2012, 2021], 'AWD', 5, ['V6 TDI', 'R-Line']],
    ['Amarok', 'pickup-truck', [2000, 3000], ['diesel'], [3_800_000, 6_800_000], [2013, 2022], '4WD', 5, ['Highline', 'V6']],
  ] },
  { name: 'Land Rover', popular: false, weight: 3, country: 'United Kingdom', aliases: ['range rover', 'landrover'], models: [
    ['Range Rover Sport', 'suv', [3000], ['diesel', 'petrol'], [7_500_000, 18_500_000], [2014, 2023], '4WD', 5, ['HSE', 'Autobiography']],
    ['Discovery', 'suv', [3000], ['diesel'], [6_200_000, 12_500_000], [2014, 2022], '4WD', 7, ['HSE', 'SE']],
    ['Defender', 'suv', [3000], ['diesel'], [10_500_000, 20_500_000], [2020, 2024], '4WD', 6, ['110 SE', '90 X']],
    ['Range Rover Evoque', 'suv', [2000], ['petrol', 'diesel'], [3_800_000, 7_200_000], [2014, 2022], 'AWD', 5, ['Dynamic', 'R-Dynamic']],
  ] },
  { name: 'Mitsubishi', popular: false, weight: 3, country: 'Japan', models: [
    ['Pajero', 'suv', [3200, 3800], ['diesel', 'petrol'], [2_800_000, 6_200_000], [2012, 2021], '4WD', 7, ['Exceed', 'GLS']],
    ['Outlander', 'suv', [2400], ['petrol', 'hybrid'], [2_300_000, 4_600_000], [2013, 2022], 'AWD', 7, ['PHEV', '24G']],
    ['L200', 'pickup-truck', [2400], ['diesel'], [3_200_000, 5_200_000], [2013, 2023], '4WD', 5, ['Double Cab', 'Sportero']],
    ['RVR', 'suv', [1800], ['petrol'], [1_500_000, 2_400_000], [2012, 2019], '2WD', 5, ['G']],
  ] },
  { name: 'Isuzu', popular: false, weight: 3, country: 'Japan', models: [
    ['D-Max', 'pickup-truck', [2500, 3000], ['diesel'], [3_200_000, 6_100_000], [2013, 2024], '4WD', 5, ['Double Cab', 'Single Cab']],
    ['MU-X', 'suv', [3000], ['diesel'], [4_600_000, 7_200_000], [2015, 2023], '4WD', 7, ['LS-T']],
    ['NQR', 'pickup-truck', [5200], ['diesel'], [4_200_000, 7_200_000], [2013, 2023], '2WD', 3, ['Truck']],
  ] },
  { name: 'Ford', popular: false, weight: 3, country: 'USA', models: [
    ['Ranger', 'pickup-truck', [2200, 3200], ['diesel'], [3_600_000, 8_200_000], [2013, 2024], '4WD', 5, ['Wildtrak', 'XLT', 'Raptor']],
    ['Everest', 'suv', [2000, 3200], ['diesel'], [4_600_000, 9_200_000], [2015, 2024], '4WD', 7, ['Titanium', 'Limited']],
    ['Fiesta', 'hatchback', [1000, 1600], ['petrol'], [900_000, 1_600_000], [2013, 2019], '2WD', 5, ['Titanium']],
  ] },
]

export const DEALERS = [
  { name: 'Axis Motors', town: 'nairobi', area: 'Ngong Road', colour: '#123b5d', tagline: 'Quality Japanese imports, inspected and ready', verified: true, since: 2012 },
  { name: 'Kilimani Auto Hub', town: 'nairobi', area: 'Argwings Kodhek Road', colour: '#0f766e', tagline: 'Family cars with full service history', verified: true, since: 2016 },
  { name: 'Prestige Autohaus', town: 'nairobi', area: 'Westlands', colour: '#1f2937', tagline: 'Premium German and luxury vehicles', verified: true, since: 2014 },
  { name: 'Coastline Motors', town: 'mombasa', area: 'Nyali', colour: '#0e7490', tagline: 'Direct from the port to your driveway', verified: true, since: 2010 },
  { name: 'Lakeside Cars', town: 'kisumu', area: 'Mega Plaza', colour: '#7c2d12', tagline: "Western Kenya's trusted car yard", verified: false, since: 2019 },
  { name: 'Rift Valley Autos', town: 'nakuru', area: 'Kenyatta Avenue', colour: '#365314', tagline: 'Pickups, SUVs and farm-ready workhorses', verified: true, since: 2015 },
  { name: 'Highland Motor Co.', town: 'eldoret', area: 'Uganda Road', colour: '#4c1d95', tagline: 'Honest prices in the North Rift', verified: false, since: 2020 },
  { name: 'Thika Road Motors', town: 'thika', area: 'Thika Superhighway', colour: '#9a3412', tagline: 'Affordable daily drivers and trade-ins', verified: false, since: 2021 },
]

export const PRIVATE_SELLERS = [
  ['Wanjiku Kamau', 'wanjiku@example.com', 'nairobi'],
  ['Otieno Ochieng', 'otieno@example.com', 'kisumu'],
  ['Hassan Abdalla', 'hassan@example.com', 'mombasa'],
  ['Cheruiyot Kiprono', 'kiprono@example.com', 'eldoret'],
  ['Njeri Mwangi', 'njeri@example.com', 'nakuru'],
  ['Peter Mutua', 'mutua@example.com', 'machakos'],
]

export const PACKAGES = [
  { name: 'Basic Listing', description: 'Free listing for 60 days. Perfect for private sellers.', price: 0, durationDays: 60, listingLimit: 1, featured: false, boostDays: 0, analytics: false, audience: 'ALL', sort: 1 },
  { name: 'Premium Listing', description: 'Top-of-search boost for 7 days plus performance analytics.', price: 1_500, durationDays: 60, listingLimit: 1, featured: false, boostDays: 7, analytics: true, audience: 'ALL', sort: 2 },
  { name: 'Featured Listing', description: 'Homepage feature and search boost for 14 days. Maximum exposure.', price: 3_500, durationDays: 60, listingLimit: 1, featured: true, boostDays: 14, analytics: true, audience: 'ALL', sort: 3 },
  { name: 'Dealer Starter', description: 'Up to 50 active listings with dealer storefront and analytics.', price: 15_000, durationDays: 30, listingLimit: 50, featured: false, boostDays: 0, analytics: true, audience: 'DEALER', sort: 4 },
  { name: 'Dealer Pro', description: 'Up to 200 active listings, 5 featured slots and priority support.', price: 35_000, durationDays: 30, listingLimit: 200, featured: true, boostDays: 7, analytics: true, audience: 'DEALER', sort: 5 },
]

export const CMS_PAGES = {
  about: {
    title: 'About GariNice',
    body: `GariNice is a Kenyan car marketplace built to make buying and selling vehicles simpler, safer and more transparent.

## What we do
We connect buyers with dealers and private sellers across Kenya — from Nairobi and Mombasa to Kisumu, Nakuru and Eldoret. Every listing follows a consistent structure so you can compare vehicles on the details that matter: year, mileage, engine, condition and price.

## How we keep the marketplace trustworthy
- Listings are reviewed by our moderation team before they go live.
- Dealers are only marked **verified** after our team has checked their business registration and physical premises.
- Buyers can report suspicious listings with one click, and we act on every report.
- Seller phone numbers are only shown when the seller chooses to share them.

## Our commitment
We never present estimates as facts. Where we show running-cost estimates, they are clearly labelled and intended only as a guide.`,
  },
  'how-it-works': {
    title: 'How GariNice works',
    body: `## For buyers
- **Search** thousands of cars by make, model, budget, year, body type and location.
- **Compare** structured specifications, photos and seller details.
- **Save** cars you like and get back to them anytime.
- **Contact** sellers securely through in-app messaging, or by phone and WhatsApp where the seller allows it.

## For sellers
- **Create an account** as a private seller or dealer.
- **List your car** with our step-by-step wizard — it takes about 10 minutes.
- **Get reviewed** — our team checks listings to keep the marketplace safe.
- **Manage enquiries** from your dashboard, and mark the car as sold when you are done.

## For dealers
Dealers get a branded storefront, team accounts, inventory tools and performance analytics. See our dealer packages on the [Sell your car](/sell) page.`,
  },
  faq: {
    title: 'Frequently asked questions',
    body: `### Do I need an account to browse cars?
No. Anyone can search and view listings. You only need an account to save cars, message sellers or list a vehicle.

### How much does it cost to list a car?
Private sellers can list for free with a Basic Listing. Premium and Featured packages give your car extra visibility. Dealers can choose a monthly package.

### How do I pay?
We currently accept M-Pesa. You will receive an STK push on your phone to confirm payment. We never ask for your M-Pesa PIN outside of that prompt.

### What does "verified" mean?
A verified badge means our team has manually checked the seller's identity or dealership documents. It does not guarantee the condition of a specific vehicle — always inspect a car before you pay.

### What is the difference between Kenyan Used, Foreign Used and Direct Import?
**Kenyan Used** cars have been registered and driven in Kenya. **Foreign Used** cars were used abroad and imported. **Direct Import** listings are vehicles that can be ordered and shipped to you.

### How do I report a suspicious listing?
Open the listing and choose "Report this listing". Our moderation team reviews every report.

### How long does a listing stay live?
Listings stay live for 60 days by default. You can renew, pause or mark a car as sold at any time.`,
  },
  safety: {
    title: 'Buying and selling safely',
    body: `## Tips for buyers
- Always view the vehicle in person before paying anything.
- Never pay a deposit to "hold" a car you have not seen.
- Verify the logbook with NTSA and confirm the seller's ID matches.
- Have the car inspected by a trusted mechanic or an inspection centre.
- Meet in safe, public places during daylight.

## Tips for sellers
- Never release the logbook or vehicle before payment has cleared in your account.
- Be wary of buyers who overpay and ask for a refund of the difference.
- Do not share M-Pesa PINs or one-time passwords with anyone.

## Report problems
If something feels wrong, use "Report this listing" or contact our team.`,
  },
  terms: {
    title: 'Terms of use',
    body: `These terms govern your use of GariNice. By creating an account or using the marketplace, you agree to them.

## Listings
Sellers are responsible for the accuracy of their listings. We may remove listings that are misleading, duplicated, fraudulent or that breach these terms.

## Payments
Payments for listing packages are processed by our payment partners. Package fees are non-refundable once a listing has been published, except where required by law.

## Conduct
You may not use GariNice to harass other users, post unlawful content, or attempt to defraud anyone.

## Liability
GariNice is a marketplace. Contracts of sale are between buyers and sellers. We do not inspect or guarantee vehicles.

*This is demo content and is not legal advice.*`,
  },
  privacy: {
    title: 'Privacy policy',
    body: `We respect your privacy and handle personal data in line with the Kenya Data Protection Act, 2019.

## What we collect
Account details (name, email, phone), listing information, messages you send through the platform, and usage analytics.

## How we use it
To operate the marketplace, prevent fraud, deliver notifications you have opted into, and improve our services.

## Your choices
Sellers choose whether their phone number is shown on listings. You can update notification preferences or delete your account from your account settings at any time.

*This is demo content and is not legal advice.*`,
  },
  help: {
    title: 'Help centre',
    body: `## Getting started
- [How GariNice works](/how-it-works)
- [Frequently asked questions](/faq)
- [Buying and selling safely](/safety)

## Still need help?
Use our [contact form](/contact) and our team will respond within one business day.`,
  },
}

export const DESCRIPTIONS = [
  'Very clean unit, accident-free with original paint. Serviced on schedule and ready to drive away.',
  'Well maintained and driven gently. Tyres in good condition, AC chilling, no mechanical issues.',
  'Low mileage, one owner since registration. Service records available for inspection.',
  'Freshly imported, duty paid and ready for registration. Full inspection report available on request.',
  'Excellent condition inside and out. Smooth gearbox, strong engine, no warning lights.',
  'Fuel efficient and reliable — perfect for daily commuting and long trips upcountry.',
]
