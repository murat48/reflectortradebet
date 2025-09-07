// stellar-manager-secure.ts
import { Keypair } from '@stellar/stellar-sdk';
import CryptoJS from 'crypto-js';

interface EncryptedKeypairData {
  encryptedSecretKey: string;
  publicKey: string;
  timestamp: number;
  salt: string;
  iv: string;
}

interface KeypairInfo {
  publicKey: string;
  remainingHours: number;
  expiresAt: Date;
  isEncrypted: boolean;
}

export class SecureStellarManager {
  private keypair: Keypair | null = null;
  private readonly KEYPAIR_LIFETIME = 24 * 60 * 60 * 1000; // 24 saat
  private readonly ENCRYPTION_KEY = 'stellar-testnet-secure-2024-v1';

  /**
   * Metni şifreler
   */
  private encrypt(text: string, salt: string): { encrypted: string; iv: string } {
    const iv = CryptoJS.lib.WordArray.random(128/8);
    const key = CryptoJS.PBKDF2(this.ENCRYPTION_KEY, salt, {
      keySize: 256/32,
      iterations: 10000
    });
    
    const encrypted = CryptoJS.AES.encrypt(text, key, { iv: iv }).toString();
    
    return {
      encrypted,
      iv: iv.toString()
    };
  }

  /**
   * Metni çözer
   */
  private decrypt(encryptedText: string, salt: string, iv: string): string {
    const key = CryptoJS.PBKDF2(this.ENCRYPTION_KEY, salt, {
      keySize: 256/32,
      iterations: 10000
    });
    
    const bytes = CryptoJS.AES.decrypt(encryptedText, key, { 
      iv: CryptoJS.enc.Hex.parse(iv) 
    });
    
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Rastgele salt oluşturur
   */
  private generateSalt(): string {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  /**
   * Keypair'i alır veya yeni oluşturur
   */
  getOrCreateKeypair(): Keypair {
    const stored = localStorage.getItem('stellar_encrypted_keypair');
    
    if (stored) {
      try {
        const data: EncryptedKeypairData = JSON.parse(stored);
        const now = Date.now();
        
        // Süre kontrolü
        if (now - data.timestamp < this.KEYPAIR_LIFETIME) {
          console.log('🔐 Mevcut şifrelenmiş keypair kullanılıyor');
          
          // Şifreyi çöz
          const decryptedSecretKey = this.decrypt(
            data.encryptedSecretKey, 
            data.salt, 
            data.iv
          );
          
          this.keypair = Keypair.fromSecret(decryptedSecretKey);
          return this.keypair;
        } else {
          console.log('⏰ Şifrelenmiş keypair süresi doldu, yeni oluşturuluyor');
          localStorage.removeItem('stellar_encrypted_keypair');
        }
      } catch (error) {
        console.log('❌ Şifrelenmiş keypair okunamadı, yeni oluşturuluyor');
        console.error('Decryption error:', error);
        localStorage.removeItem('stellar_encrypted_keypair');
      }
    }

    return this.createNewEncryptedKeypair();
  }

  /**
   * Yeni şifrelenmiş keypair oluşturur
   */
  private createNewEncryptedKeypair(): Keypair {
    console.log('🆕 Yeni şifrelenmiş keypair oluşturuluyor');
    
    // Yeni keypair oluştur
    this.keypair = Keypair.random();
    
    // Şifreleme parametreleri
    const salt = this.generateSalt();
    const { encrypted, iv } = this.encrypt(this.keypair.secret(), salt);
    
    // Şifrelenmiş veri yapısı
    const encryptedData: EncryptedKeypairData = {
      encryptedSecretKey: encrypted,
      publicKey: this.keypair.publicKey(), // Public key şifrelenmez
      timestamp: Date.now(),
      salt,
      iv
    };
    
    // localStorage'a şifrelenmiş olarak kaydet
    localStorage.setItem('stellar_encrypted_keypair', JSON.stringify(encryptedData));
    
    console.log('💾 Keypair şifrelenmiş olarak kaydedildi');
    console.log('🔑 Public Key:', this.keypair.publicKey());
    
    // Testnet'te aktifleştir
    this.activateAccount();
    
    return this.keypair;
  }

  /**
   * Testnet hesabını aktifleştirir
   */
  private async activateAccount(): Promise<void> {
    if (!this.keypair) return;

    try {
      console.log('🚀 Testnet hesabı aktifleştiriliyor...');
      
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${this.keypair.publicKey()}`
      );
      
      if (response.ok) {
        console.log('✅ Testnet hesabı başarıyla aktifleştirildi!');
        console.log('💰 10,000 Test XLM alındı');
      } else {
        const errorText = await response.text();
        if (errorText.includes('createAccountAlreadyExist')) {
          console.log('⚠️ Hesap zaten mevcut ve aktif');
        } else {
          console.log('⚠️ Friendbot yanıtı:', response.status, errorText);
        }
      }
    } catch (error) {
      console.error('❌ Hesap aktifleştirme hatası:', error);
    }
  }

  /**
   * Keypair bilgilerini döner
   */
  getKeypairInfo(): KeypairInfo {
    if (!this.keypair) {
      this.getOrCreateKeypair();
    }
    
    const stored = localStorage.getItem('stellar_encrypted_keypair');
    const data: EncryptedKeypairData = stored ? JSON.parse(stored) : { timestamp: Date.now() };
    
    const remainingTime = this.KEYPAIR_LIFETIME - (Date.now() - data.timestamp);
    const remainingHours = Math.floor(remainingTime / (1000 * 60 * 60));
    
    return {
      publicKey: this.keypair!.publicKey(),
      remainingHours: Math.max(0, remainingHours),
      expiresAt: new Date(data.timestamp + this.KEYPAIR_LIFETIME),
      isEncrypted: true
    };
  }

  /**
   * Manuel yenileme - mevcut şifrelenmiş keypair'i siler ve yeni oluşturur
   */
  forceRenewKeypair(): Keypair {
    console.log('🔄 Şifrelenmiş keypair manuel olarak yenileniyor...');
    localStorage.removeItem('stellar_encrypted_keypair');
    return this.getOrCreateKeypair();
  }

  /**
   * Şifreleme durumunu kontrol eder
   */
  isDataEncrypted(): boolean {
    const stored = localStorage.getItem('stellar_encrypted_keypair');
    return stored !== null;
  }

  /**
   * Mevcut keypair'i döner (şifrelenmiş versiyondan)
   */
  getCurrentKeypair(): Keypair | null {
    return this.keypair;
  }

  /**
   * localStorage'dan şifrelenmiş veriyi tamamen temizler
   */
  clearEncryptedData(): void {
    localStorage.removeItem('stellar_encrypted_keypair');
    this.keypair = null;
    console.log('🗑️ Şifrelenmiş keypair verisi temizlendi');
  }
}