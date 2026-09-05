<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paiement Mobile Money</title>

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Poppins', sans-serif;
    }

    body {
      background: linear-gradient(135deg, #4facfe, #00f2fe);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }

    .payment-container {
      background: #fff;
      padding: 30px;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      max-width: 400px;
      width: 90%;
      text-align: center;
      animation: fadeIn 1s ease-in-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    h2 {
      margin-bottom: 20px;
      color: #333;
    }

    .amount-display {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 12px;
      margin-bottom: 20px;
      color: #333;
    }

    .amount-display strong {
      font-size: 22px;
      color: #4facfe;
    }

    .options {
      display: flex;
      justify-content: space-around;
      margin-bottom: 20px;
    }

    .option-btn {
      flex: 1;
      margin: 0 5px;
      padding: 12px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      background: #eee;
      transition: 0.3s;
      font-weight: 600;
    }

    .option-btn.active,
    .option-btn:hover {
      background: #4facfe;
      color: white;
    }

    .instructions {
      margin-top: 20px;
      text-align: left;
      font-size: 14px;
      color: #555;
      display: none;
      animation: fadeIn 0.5s ease-in-out;
      background: #f8f8f8;
      padding: 15px;
      border-radius: 10px;
    }

    .instructions ol {
      padding-left: 20px;
    }

    .instructions li {
      margin-bottom: 10px;
    }

    .pay-btn,
    .validate-btn {
      margin-top: 20px;
      width: 100%;
      padding: 15px;
      border: none;
      border-radius: 12px;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: 0.3s;
    }

    .pay-btn {
      background: #4facfe;
    }

    .pay-btn:hover {
      background: #00c6ff;
    }

    .validate-btn {
      background: #2196f3;
    }

    .validate-btn:hover {
      background: #1976d2;
    }

    .launch-ussd {
      margin-top: 10px;
      display: none;
      text-decoration: none;
      background: #ff9500;
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: bold;
      transition: 0.3s;
    }

    .launch-ussd:hover {
      background: #e68a00;
    }

    /* Section ID transaction */

    .verification-section {
      display: none;
      margin-top: 20px;
      animation: fadeIn 0.5s ease-in-out;
    }

    .transaction-input {
      width: 100%;
      padding: 13px;
      border: 2px solid #ddd;
      border-radius: 10px;
      font-size: 16px;
      outline: none;
      transition: 0.3s;
    }

    .transaction-input:focus {
      border-color: #4facfe;
    }

    /* Messages */

    .status-message {
      margin-top: 15px;
      padding: 14px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      display: none;
      animation: fadeIn 0.5s ease-in-out;
    }

    .verification-message {
      background: #fff3cd;
      color: #856404;
    }

    .pending-message {
      background: #e8f4fd;
      color: #1565c0;
    }

    /* Service client */

    .support-btn {
      display: block;
      width: 100%;
      margin-top: 20px;
      padding: 13px;
      background: #333;
      color: white;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      transition: 0.3s;
    }

    .support-btn:hover {
      background: #111;
    }

    .error-message {
      display: none;
      margin-bottom: 15px;
      padding: 12px;
      border-radius: 10px;
      background: #f8d7da;
      color: #842029;
      font-size: 14px;
      font-weight: 600;
    }

    @media(max-width:500px) {

      .options {
        flex-direction: column;
      }

      .option-btn {
        margin: 5px 0;
      }

      .payment-container {
        padding: 25px 20px;
      }
    }
  </style>
</head>

<body>

  <div class="payment-container">

    <h2>Paiement Mobile Money</h2>


    <!-- ============================
         MONTANT RECUPERE DEPUIS URL
    ============================= -->

    <div class="amount-display">
      Montant à payer :
      <br>
      <strong id="amountDisplay">Chargement...</strong>
    </div>


    <!-- ============================
         MESSAGE ERREUR
    ============================= -->

    <div
      class="error-message"
      id="errorMessage">
    </div>


    <!-- ============================
         CHOIX OPERATEUR
    ============================= -->

    <div class="options">

      <button
        class="option-btn"
        data-operator="orange">
        Orange Money
      </button>

      <button
        class="option-btn"
        data-operator="mtn">
        MTN Money
      </button>

    </div>


    <!-- ============================
         INSTRUCTIONS
    ============================= -->

    <div
      class="instructions"
      id="instructions">
    </div>


    <!-- ============================
         BOUTON LANCER PAIEMENT
    ============================= -->

    <button
      class="pay-btn"
      id="payBtn"
      style="display:none;">
      Lancer le paiement
    </button>


    <!-- ============================
         LIEN USSD
    ============================= -->

    <a
      href="#"
      id="ussdLink"
      class="launch-ussd">
      Lancer la transaction
    </a>


    <!-- ============================
         VERIFICATION
    ============================= -->

    <div
      class="verification-section"
      id="verificationSection">

      <input
        type="text"
        id="transactionId"
        class="transaction-input"
        placeholder="Entrez l'ID de la transaction reçue"
      >

      <button
        class="validate-btn"
        id="validateBtn">
        Valider le paiement
      </button>


      <!-- Vérification -->

      <div
        class="status-message verification-message"
        id="verificationMessage">

        Vérification en cours...

      </div>


      <!-- Transaction en attente -->

      <div
        class="status-message pending-message"
        id="pendingMessage">

        Transaction toujours en attente.

      </div>

    </div>


    <!-- ============================
         SERVICE CLIENT
    ============================= -->

    <a
      href="https://wa.me/237XXXXXXXXX"
      class="support-btn"
      target="_blank">

      Contacter le service client

    </a>

  </div>


  <script>

    /*
    =====================================================
    CONFIGURATION

    MODIFIE SEULEMENT CES NUMEROS.

    Ils seront automatiquement utilisés partout
    dans le code.
    =====================================================
    */

    const CONFIG = {

      orangeNumber: "656720564",

      mtnNumber: "682004136"

    };


    /*
    =====================================================
    RECUPERATION DU MONTANT DEPUIS L'URL
    =====================================================

    Exemple :

    paiement.html?amount=2000

    ou

    paiement.html?montant=2000

    Le code accepte les deux.
    =====================================================
    */

    const urlParams =
      new URLSearchParams(window.location.search);

    let amount =
      urlParams.get('amount') ||
      urlParams.get('montant');


    /*
    Nettoyage du montant
    */

    if (amount) {

      amount =
        amount.replace(/[^\d]/g, '');

    }


    /*
    =====================================================
    ELEMENTS HTML
    =====================================================
    */

    const options =
      document.querySelectorAll('.option-btn');

    const instructions =
      document.getElementById('instructions');

    const payBtn =
      document.getElementById('payBtn');

    const ussdLink =
      document.getElementById('ussdLink');

    const amountDisplay =
      document.getElementById('amountDisplay');

    const errorMessage =
      document.getElementById('errorMessage');

    const verificationSection =
      document.getElementById('verificationSection');

    const transactionId =
      document.getElementById('transactionId');

    const validateBtn =
      document.getElementById('validateBtn');

    const verificationMessage =
      document.getElementById('verificationMessage');

    const pendingMessage =
      document.getElementById('pendingMessage');


    let selectedOperator = null;


    /*
    =====================================================
    VERIFICATION DU MONTANT
    =====================================================
    */

    if (!amount || Number(amount) <= 0) {

      amountDisplay.textContent =
        'Montant invalide';

      errorMessage.textContent =
        'Aucun montant valide n’a été trouvé dans l’URL.';

      errorMessage.style.display =
        'block';

      options.forEach(btn => {

        btn.disabled = true;

        btn.style.opacity = '0.5';

        btn.style.cursor = 'not-allowed';

      });

    } else {

      /*
      Afficher le montant

      Exemple :
      2 000 XAF
      */

      amountDisplay.textContent =
        Number(amount).toLocaleString('fr-FR') + ' XAF';

    }


    /*
    =====================================================
    CONFIGURATION DES ETAPES
    =====================================================
    */

    function generateSteps(operator) {

      if (operator === 'orange') {

        return `
          <ol>
            <li>
              Cliquez sur <strong>Lancer le paiement</strong>
              ci-dessous.
            </li>

            <li>
              Si nécessaire, utilisez le code :
              <br>
              <strong>
                #150*1*1*${CONFIG.orangeNumber}*${amount}#
              </strong>
            </li>

            <li>
              Entrez le numéro
              <strong>${CONFIG.orangeNumber}</strong>
              lorsque cela est demandé.
            </li>

            <li>
              Validez la transaction sur votre téléphone.
            </li>

            <li>
              Revenez ensuite sur cette page et entrez
              l'ID de transaction reçu.
            </li>
          </ol>
        `;

      }


      return `
        <ol>
          <li>
            Cliquez sur <strong>Lancer le paiement</strong>
            ci-dessous.
          </li>

          <li>
            Si nécessaire, utilisez le code :
            <br>
            <strong>
              *126*9*${CONFIG.mtnNumber}*${amount}#
            </strong>
          </li>

          <li>
            Validez la transaction sur votre téléphone.
          </li>

          <li>
            Revenez ensuite sur cette page et entrez
            l'ID de transaction reçu.
          </li>
        </ol>
      `;

    }


    /*
    =====================================================
    CHOIX OPERATEUR
    =====================================================
    */

    options.forEach(btn => {

      btn.addEventListener('click', () => {

        if (!amount) {
          return;
        }


        /*
        Retirer active des autres boutons
        */

        options.forEach(b => {

          b.classList.remove('active');

        });


        /*
        Activer le bouton sélectionné
        */

        btn.classList.add('active');


        selectedOperator =
          btn.dataset.operator;


        /*
        Afficher les instructions
        */

        instructions.innerHTML =
          generateSteps(selectedOperator);

        instructions.style.display =
          'block';


        /*
        Afficher le bouton
        */

        payBtn.style.display =
          'block';


        /*
        Cacher l'ancien lien USSD
        jusqu'au lancement
        */

        ussdLink.style.display =
          'none';

      });

    });


    /*
    =====================================================
    LANCER LE PAIEMENT
    =====================================================
    */

    payBtn.addEventListener('click', () => {

      if (!selectedOperator) {

        alert(
          'Veuillez choisir un opérateur.'
        );

        return;
      }


      if (!amount) {

        alert(
          'Le montant du paiement est invalide.'
        );

        return;
      }


      let ussdCode = '';


      /*
      MTN
      */

      if (selectedOperator === 'mtn') {

        ussdCode =
          `tel:*126*9*${CONFIG.mtnNumber}*${amount}%23`;

      }


      /*
      ORANGE
      */

      else {

        ussdCode =
          `tel:%23150*1*1*${CONFIG.orangeNumber}*${amount}%23`;

      }


      /*
      Préparer le lien USSD
      */

      ussdLink.href =
        ussdCode;


      /*
      Lancer automatiquement
      */

      ussdLink.click();


      /*
      =================================================
      PASSAGE A L'ETAPE 2
      =================================================
      */

      payBtn.style.display =
        'none';


      /*
      Afficher la zone ID transaction
      */

      verificationSection.style.display =
        'block';


      /*
      Le lien USSD reste visible pour permettre
      à l'utilisateur de relancer la transaction
      si le premier lancement n'a pas fonctionné.
      */

      ussdLink.style.display =
        'inline-block';


      /*
      Modifier le texte du lien
      */

      ussdLink.textContent =
        'Relancer la transaction';


      /*
      Focus sur le champ ID
      */

      setTimeout(() => {

        transactionId.focus();

      }, 300);

    });


    /*
    =====================================================
    VALIDATION DU PAIEMENT
    =====================================================
    */

    validateBtn.addEventListener('click', () => {

      const id =
        transactionId.value.trim();


      /*
      Vérification ID
      */

      if (!id) {

        alert(
          'Veuillez entrer l’ID de la transaction reçue.'
        );

        transactionId.focus();

        return;
      }


      /*
      Désactiver le bouton
      */

      validateBtn.disabled =
        true;

      validateBtn.style.opacity =
        '0.6';

      validateBtn.style.cursor =
        'not-allowed';


      /*
      Afficher vérification
      */

      verificationMessage.style.display =
        'block';


      /*
      Cacher le message d'attente
      */

      pendingMessage.style.display =
        'none';


      /*
      =================================================
      SIMULATION DE VERIFICATION
      =================================================

      IMPORTANT :

      Cette partie doit être remplacée par un appel
      à ton serveur PHP/API pour vérifier réellement
      la transaction.
      */

      setTimeout(() => {

        verificationMessage.style.display =
          'none';


        pendingMessage.style.display =
          'block';


      }, 3000);

    });

  </script>

</body>
</html>