# Oracle Frontend Documentation

Bu döküman, Oracle contract'ı için oluşturulan frontend arayüzünün kullanımını açıklamaktadır.

## Özellikler

### 1. Oracle Demo (Test Sayfası)
- Oracle bağlantısını test etmek için basit bir arayüz
- Stellar testnet bağlantısını doğrular
- Örnek asset fiyatı çekmeyi test eder
- Real-time test sonuçları gösterir

### 2. Oracle Dashboard (Ana Dashboard)
- **Real-time fiyat takibi**: 6 farklı asset için anlık fiyat bilgileri
- **Grafik görünümü**: Recharts kullanarak interaktif grafikler
- **TWAP hesaplamaları**: 10 period Time-Weighted Average Price
- **Fiyat alarmları**: Min/max değerler arası uyarı sistemi
- **Otomatik güncelleme**: 5 saniye - 1 dakika arası ayarlanabilir
- **Tarihsel veri**: Son 50 kayıt için geçmiş fiyat grafikleri

## Desteklenen Asset'ler

| Symbol | Name | Contract ID |
|--------|------|-------------|
| BTCLN | Bitcoin Lightning | CAWH4XMRQL7AJZCXEJVRHHMT6Y7ZPFCQCSKLIFJL3AVIQNC5TSVWKQOR |
| AQUA | Aqua | CDJF2JQINO7WRFXB2AAHLONFDPPI4M3W2UM5THGQQ7JMJDIEJYC4CMPG |
| yUSDC | Yield USDC | CABWYQLGOQ5Y3RIYUVYJZVA355YVX4SPAMN6ORDAVJZQBPPHLHRRLNMS |
| SSLX | Stellar Lumen | CA4DYJSRG7HPVTPJZAIPNUC3UJCQEZ456GPLYVYR2IATCBAPTQV6UUKZ |
| EURC | Euro Coin | CCBINL4TCQVEQN2Q2GO66RS4CWUARIECZEJA7JVYQO3GVF4LG6HJN236 |
| KALE | Kale | CAOTLCI7DROK3PI4ANOFPHPMBCFWVHURJM2EKQSO725SYCWBWE5U22OG |

## Oracle Contract Metodları

Frontend aşağıdaki Oracle contract metodlarını kullanır:

### Temel Fiyat Metodları
- `get_price_and_timestamp(token_address)`: Fiyat ve timestamp getir
- `get_price_change_percentage(token_address)`: Fiyat değişim yüzdesi
- `get_twap_price(token_address, records)`: TWAP hesapla
- `get_historical_prices(token_address, records)`: Tarihsel veriler

### Oracle Bilgileri
- `get_oracle_decimals()`: Oracle decimal sayısı
- `get_oracle_resolution()`: Güncelleme aralığı
- `get_last_update_timestamp()`: Son güncelleme zamanı

### Alarm ve Kontrol
- `check_price_alert(token_address, min_threshold, max_threshold)`: Fiyat alarmı kontrol

## Teknik Detaylar

### Kullanılan Teknolojiler
- **React/Next.js**: Frontend framework
- **TypeScript**: Type safety
- **Recharts**: Grafik kütüphanesi
- **Tailwind CSS**: Styling
- **Stellar SDK**: Blockchain entegrasyonu

### Oracle Contract ID
```
CBKP2C5PJY2IH35TD5NVVYGT47X3RO2PU7FWWGTKTF7HOP5RRUH577J2
```

### Network Ayarları
- **Network**: Stellar Testnet
- **RPC URL**: https://soroban-testnet.stellar.org
- **Decimals**: Oracle veriler 14 decimal precision kullanır

## Kullanım Adımları

### 1. Demo Sayfası ile Başlayın
1. "Oracle Demo" sekmesine gidin
2. "Test Connection" butonuna tıklayarak bağlantıyı test edin
3. "Test Price Fetch" ile örnek fiyat çekmeyi deneyin

### 2. Oracle Dashboard Kullanımı
1. "Oracle Dashboard" sekmesine geçin
2. Asset kartlarından birini seçerek detaylı görünüm açın
3. "Refresh Data" ile manuel güncelleme yapın
4. "Auto Refresh" ile otomatik güncellemeleri aktifleştirin

### 3. Fiyat Alarmları
1. Asset kartındaki "Price Alert" bölümünü kullanın
2. Min ve Max değerleri girin
3. "Active/Inactive" butonuyla alarmı aktif edin
4. Console'da alarm mesajlarını kontrol edin

### 4. Grafik Analizi
- Line Chart: Fiyat trendini gösterir
- Area Chart: Fiyat alanını görselleştirir
- Bar Chart: TWAP karşılaştırması

## Hata Ayıklama

### Yaygın Problemler
1. **Bağlantı Hatası**: Stellar testnet erişimini kontrol edin
2. **Fiyat Verisi Yok**: Oracle contract'ın aktif olduğunu doğrulayın
3. **Yavaş Yükleme**: Network bağlantısını kontrol edin

### Console Logları
Browser developer tools'ta console sekmesini açarak detaylı hata mesajlarını görebilirsiniz.

## API Entegrasyonu

```typescript
// Oracle service oluşturma
const sorobanService = new SorobanService(ORACLE_CONTRACT_ID)

// Fiyat getirme
const price = await sorobanService.getCurrentPrice(assetAddress)

// Contract metodunu çağırma
const result = await callOracleContract('get_price_and_timestamp', [assetAddress])
```

## Gelecek Geliştirmeler

- [ ] Daha fazla asset desteği
- [ ] Push notification sistemi
- [ ] Tarihsel veriler için daha uzun periyotlar
- [ ] Export/import functionality
- [ ] Mobile responsive iyileştirmeler
- [ ] Real-time WebSocket bağlantısı

## Destek

Sorun veya önerileriniz için GitHub repository'sini kullanabilirsiniz.
