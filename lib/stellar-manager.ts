// stellar-manager.ts
import { Keypair } from '@stellar/stellar-sdk';

interface KeypairData {
  secretKey: string;
  publicKey: string;
  timestamp: number;
}

interface KeypairInfo {
  publicKey: string;
  remainingHours: number;
  expiresAt: Date;
}

export class StellarManager {
  private keypair: Keypair | null = null;
  private readonly KEYPAIR_LIFETIME = 24 * 60 * 60 * 1000; // 24 saat millisaniye cinsinden

  getOrCreateKeypair(): Keypair {
    const stored = localStorage.getItem('stellar_keypair_data');
    
    if (stored) {
      try {
        const { secretKey, timestamp }: KeypairData = JSON.parse(stored);
        const now = Date.now();
        
        // 24 saat geçti mi kontrol et
        if (now - timestamp < this.KEYPAIR_LIFETIME) {
          console.log('✅ Mevcut keypair kullanılıyor');
          this.keypair = Keypair.fromSecret(secretKey);
          return this.keypair;
        } else {
          console.log('⏰ Keypair süresi doldu, yeni oluşturuluyor');
          localStorage.removeItem('stellar_keypair_data');
        }
      } catch (error) {
        console.log('❌ Stored keypair okunamadı, yeni oluşturuluyor');
        localStorage.removeItem('stellar_keypair_data');
      }
    }

    // Yeni keypair oluştur
    console.log('🆕 Yeni keypair oluşturuluyor');
    this.keypair = Keypair.random();
    
    // localStorage'a kaydet
    const keypairData: KeypairData = {
      secretKey: this.keypair.secret(),
      publicKey: this.keypair.publicKey(),
      timestamp: Date.now()
    };
    
    localStorage.setItem('stellar_keypair_data', JSON.stringify(keypairData));
    
    // Testnet'te aktifleştir
    this.activateAccount();
    
    return this.keypair;
  }

  private async activateAccount(): Promise<void> {
    if (!this.keypair) return;

    try {
      console.log('🚀 Hesap aktifleştiriliyor...');
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${this.keypair.publicKey()}`
      );
      
      if (response.ok) {
        console.log('✅ Hesap başarıyla aktifleştirildi!');
      } else {
        console.log('⚠️ Hesap zaten aktif olabilir');
      }
    } catch (error) {
      console.error('❌ Hesap aktifleştirme hatası:', error);
    }
  }

  getKeypairInfo(): KeypairInfo {
    if (!this.keypair) {
      this.getOrCreateKeypair();
    }
    
    const stored = JSON.parse(localStorage.getItem('stellar_keypair_data') || '{}') as KeypairData;
    const remainingTime = this.KEYPAIR_LIFETIME - (Date.now() - stored.timestamp);
    const remainingHours = Math.floor(remainingTime / (1000 * 60 * 60));
    
    return {
      publicKey: this.keypair!.publicKey(),
      remainingHours: Math.max(0, remainingHours),
      expiresAt: new Date(stored.timestamp + this.KEYPAIR_LIFETIME)
    };
  }

  // Manuel yenileme için
  forceRenewKeypair(): Keypair {
    localStorage.removeItem('stellar_keypair_data');
    return this.getOrCreateKeypair();
  }
}