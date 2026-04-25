# Kişisel Finans Yönetimi (Personal Finance Management)

Bu proje, kişisel gelir, gider, bütçe ve yatırımları takip etmek için geliştirilmiş bir React web uygulamasıdır.
This project is a React web application designed to track personal income, expenses, budgets, and investments.

## Özellikler / Features

*   **Gelir/Gider Takibi (Income/Expense Tracking):** Günlük harcamaları ve gelirleri kaydedin ve kategorize edin. (Record and categorize daily expenses and income.)
*   **Bütçe Yönetimi (Budget Management):** Kategorilere göre aylık bütçeler oluşturun ve takip edin. (Create and track monthly budgets by category.)
*   **Yatırım Portföyü (Investment Portfolio):** Altın, Döviz, Fon ve Hisse Senedi yatırımlarınızı anlık fiyatlarla izleyin. (Monitor Gold, Forex, Fund, and Stock investments with real-time prices.)
*   **Görsel Raporlar (Visual Reports):** Harcama dağılımınızı ve varlık durumunuzu grafiklerle analiz edin. (Analyze spending distribution and asset status with charts.)
*   **Excel Dışa/İçe Aktarma (Excel Export/Import):** Verilerinizi Excel formatında yedekleyin veya geri yükleyin. (Backup or restore your data in Excel format.)
*   **Dark/Light Mod (Dark/Light Mode):** Kullanıcı tercihine göre tema seçimi. (Theme selection based on user preference.)

## Kurulum / Setup

1.  Projeyi klonlayın / Clone the project:
    ```bash
    git clone https://github.com/KULLANICI_ADI/PROJE_ADI.git
    cd PROJE_ADI
    ```

2.  Bağımlılıkları yükleyin / Install dependencies:
    ```bash
    npm install
    ```

3.  `.env` dosyasını oluşturun / Create `.env` file:
    `src` klasörü altındaki `firebase.js` dosyasının çalışması için kök dizinde `.env` dosyası oluşturun ve aşağıdaki Firebase yapılandırma bilgilerinizi ekleyin:
    Create a `.env` file in the root directory for `src/firebase.js` to work and add your Firebase configuration details below:

    ```env
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
    VITE_FINNHUB_API_KEY=your_finnhub_api_key
    VITE_CORS_PROXY_URL=https://corsproxy.io/?
    ```

    `VITE_FINNHUB_API_KEY` ABD hisse fiyatları için kullanılır. `VITE_CORS_PROXY_URL` ise Yahoo Finance üzerinden BIST/fon fiyatı alınırken tarayıcı CORS engellerini aşmak için opsiyoneldir.

4.  Uygulamayı çalıştırın / Run the application:
    ```bash
    npm run dev
    ```

## Teknolojiler / Technologies

*   React
*   Vite
*   Firebase (Auth, Firestore)
*   Recharts (Grafikler/Charts)
*   XLSX (Excel İşlemleri/Excel Operations)

## Güvenlik Notu / Security Note

Firestore kurallarında kullanıcı kimliği (`uid`) ile alan kodu (`alanKodu`) ilişkisinin doğrulandığından emin olun. Alan kodu istemci tarafında saklandığı için veri erişimi yalnızca istemci filtrelerine bırakılmamalıdır.
