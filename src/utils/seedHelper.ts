import { supabase } from '../lib/supabase';

export const checkForExistingData = async () => {
  try {
    const { count, error } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error checking database status:', error);
      return false;
    }
    
    return (count || 0) > 0;
  } catch (e) {
    console.error('Database connection failed:', e);
    return false;
  }
};

export const seedDatabase = async () => {
  try {
    console.log('Seeding database with premium Middle Eastern marketplace records...');

    // 1. Countries, Cities, Zones
    const { data: countries } = await supabase
      .from('countries')
      .insert([
        { name: 'المملكة العربية السعودية', code: 'SA' }
      ])
      .select();

    if (!countries || countries.length === 0) return false;
    const countryId = countries[0].id;

    const { data: cities } = await supabase
      .from('cities')
      .insert([
        { country_id: countryId, name: 'الرياض' },
        { country_id: countryId, name: 'جدة' }
      ])
      .select();

    if (!cities || cities.length === 0) return false;
    const riyadhId = cities[0].id;

    const { data: zones } = await supabase
      .from('zones')
      .insert([
        { city_id: riyadhId, name: 'الملز' },
        { city_id: riyadhId, name: 'الياسمين' },
        { city_id: riyadhId, name: 'العليا' }
      ])
      .select();

    if (!zones || zones.length === 0) return false;
    const yasmineId = zones[1].id;
    const olayaId = zones[2].id;

    // 2. Categories
    const { data: categories } = await supabase
      .from('categories')
      .insert([
        { name: 'مطاعم' },
        { name: 'سوبر ماركت' },
        { name: 'صيدلية' },
        { name: 'قهوة وحلى' }
      ])
      .select();

    if (!categories || categories.length === 0) return false;
    const restaurantCatId = categories[0].id;
    const groceryCatId = categories[1].id;
    const pharmacyCatId = categories[2].id;
    const cafeCatId = categories[3].id;

    // 3. Merchants
    const { data: merchants } = await supabase
      .from('merchants')
      .insert([
        { business_name: 'شاورما جليلة' },
        { business_name: 'بيتزا مايسترو' },
        { business_name: 'أسواق التميمي' },
        { business_name: 'صيدليات الدواء' },
        { business_name: 'هاف مليون' }
      ])
      .select();

    if (!merchants || merchants.length === 0) return false;
    const shawarmaMerchId = merchants[0].id;
    const pizzaMerchId = merchants[1].id;
    const tamimiMerchId = merchants[2].id;
    const pharmacyMerchId = merchants[3].id;
    const halfMillionId = merchants[4].id;

    // 4. Merchant Branches
    const { data: branches } = await supabase
      .from('merchant_branches')
      .insert([
        { merchant_id: shawarmaMerchId, zone_id: olayaId, name: 'فرع العليا - شاورما جليلة' },
        { merchant_id: pizzaMerchId, zone_id: yasmineId, name: 'فرع الياسمين - مايسترو' },
        { merchant_id: tamimiMerchId, zone_id: olayaId, name: 'التميمي إكسبرس - العليا' },
        { merchant_id: pharmacyMerchId, zone_id: yasmineId, name: 'صيدلية الدواء - الياسمين' },
        { merchant_id: halfMillionId, zone_id: olayaId, name: 'هاف مليون - طريق الملك فهد' }
      ])
      .select();

    if (!branches || branches.length === 0) return false;
    const shawarmaBranchId = branches[0].id;
    const pizzaBranchId = branches[1].id;
    const tamimiBranchId = branches[2].id;
    const pharmacyBranchId = branches[3].id;
    const cafeBranchId = branches[4].id;

    // 5. Products & Product Variants & Images
    // Products: Shawarma جليلة
    const { data: products1 } = await supabase
      .from('products')
      .insert([
        { branch_id: shawarmaBranchId, category_id: restaurantCatId, name: 'شاورما عربي دجاج فرط', price: 24.00 },
        { branch_id: shawarmaBranchId, category_id: restaurantCatId, name: 'شاورما صغير كلاسيك', price: 8.50 },
        { branch_id: shawarmaBranchId, category_id: restaurantCatId, name: 'شاورما جليلة بالجبن', price: 14.00 }
      ])
      .select();

    if (products1) {
      await supabase.from('product_images').insert([
        { product_id: products1[0].id, url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=400' },
        { product_id: products1[1].id, url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=400' }
      ]);
      await supabase.from('product_variants').insert([
        { product_id: products1[0].id, name: 'حجم دبل', price_modifier: 12.00 },
        { product_id: products1[0].id, name: 'بدون بصل', price_modifier: 0.00 }
      ]);
    }

    // Products: Maestro Pizza
    const { data: products2 } = await supabase
      .from('products')
      .insert([
        { branch_id: pizzaBranchId, category_id: restaurantCatId, name: 'بيتزا رانش الدجاج', price: 35.00 },
        { branch_id: pizzaBranchId, category_id: restaurantCatId, name: 'بيتزا الخضار الكلاسيكية', price: 29.00 },
        { branch_id: pizzaBranchId, category_id: restaurantCatId, name: 'بطاطس ودجز بالفرن', price: 12.00 }
      ])
      .select();

    if (products2) {
      await supabase.from('product_images').insert([
        { product_id: products2[0].id, url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400' }
      ]);
      await supabase.from('product_variants').insert([
        { product_id: products2[0].id, name: 'حجم كبير وسط الأطراف جبنة', price_modifier: 10.00 },
        { product_id: products2[0].id, name: 'عجينة رقيقة', price_modifier: 0.00 }
      ]);
    }

    // Products: Danube/Tamimi Groceries
    const { data: products3 } = await supabase
      .from('products')
      .insert([
        { branch_id: tamimiBranchId, category_id: groceryCatId, name: 'حليب نادك طويل الأجل كامل الدسم 1 لتر', price: 6.50 },
        { branch_id: tamimiBranchId, category_id: groceryCatId, name: 'مياه نوفا 24 عبوة * 330 مل', price: 18.00 },
        { branch_id: tamimiBranchId, category_id: groceryCatId, name: 'بيض طازج وطني صحن 30 حبة', price: 21.00 }
      ])
      .select();

    if (products3) {
      await supabase.from('product_images').insert([
        { product_id: products3[0].id, url: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=400' }
      ]);
    }

    // Products: Pharmacy Health Meds
    const { data: products4 } = await supabase
      .from('products')
      .insert([
        { branch_id: pharmacyBranchId, category_id: pharmacyCatId, name: 'بندول نايت 20 قرص مسكن', price: 14.50 },
        { branch_id: pharmacyBranchId, category_id: pharmacyCatId, name: 'معقم يدين ديتول خالي من العطور 50 مل', price: 8.00 },
        { branch_id: pharmacyBranchId, category_id: pharmacyCatId, name: 'فيروز شراب حديد للجسم', price: 22.00 }
      ])
      .select();

    // Products: halfMillion Cafe
    const { data: products5 } = await supabase
      .from('products')
      .insert([
        { branch_id: cafeBranchId, category_id: cafeCatId, name: 'سيجنتشر لاتيه مثلج مكس', price: 19.00 },
        { branch_id: cafeBranchId, category_id: cafeCatId, name: 'سبيشالتي كورتادو حار', price: 15.00 },
        { branch_id: cafeBranchId, category_id: cafeCatId, name: 'كرواسون زبدة فرنسي طازج', price: 11.00 }
      ])
      .select();

    if (products5) {
      await supabase.from('product_images').insert([
        { product_id: products5[0].id, url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&q=80&w=400' }
      ]);
    }

    // 6. Coupons
    await supabase
      .from('coupons')
      .insert([
        { code: 'HAAT10', discount_percent: 10 },
        { code: 'RAMADAN', discount_percent: 25 },
        { code: 'SAUDI96', discount_percent: 40 }
      ]);

    // 7. Offers & Banners
    await supabase
      .from('banners')
      .insert([
        { title: 'عرض مايسترو الأقوى: اشتري 1 واحصل على 2', image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=800', is_active: true, display_order: 1 },
        { title: 'شاورما جليلة توصيل مجاناً مع هاف بلس', image_url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=800', is_active: true, display_order: 2 }
      ]);

    await supabase
      .from('offers')
      .insert([
        { title: 'خصم 25% على المشتريات الطبية', discount_percent: 25, start_date: new Date().toISOString(), end_date: new Date(Date.now() + 864000000).toISOString(), is_active: true },
        { title: 'عرض قهوة الصباح: خصم 15% على جميع المشروبات', discount_percent: 15, start_date: new Date().toISOString(), end_date: new Date(Date.now() + 864000000).toISOString(), is_active: true }
      ]);

    // 8. Create roles
    const { data: roles } = await supabase
      .from('roles')
      .insert([
        { name: 'customer', description: 'Regular customer placing orders' },
        { name: 'merchant', description: 'Store merchant operating branches' },
        { name: 'driver', description: 'Courier carrying order shipments' },
        { name: 'admin', description: 'System operator' }
      ])
      .select();

    console.log('Database seeding successfully finalized.');
    return true;
  } catch (err) {
    console.error('Database seeding failed:', err);
    return false;
  }
};
