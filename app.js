import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, query, orderBy, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Firebase Configuration from User
const firebaseConfig = {
  apiKey: "AIzaSyCRtfmA3fz1KLot-lbytOu_GRLY9bQRvF4",
  authDomain: "mocka-48e0b.firebaseapp.com",
  projectId: "mocka-48e0b",
  storageBucket: "mocka-48e0b.firebasestorage.app",
  messagingSenderId: "742433263897",
  appId: "1:742433263897:web:d9ca7afdf8563443fdf588"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Memory Data (Now synced with Firestore)
let cafes = [];
let records = [];
let extractedMenusByCafe = {};
let currentUser = null;

let unsubCafes = null;
let unsubRecords = null;
let unsubOcr = null;

// DOM Elements
const views = {
    login: document.getElementById('view-login'),
    profileSetup: document.getElementById('view-profile-setup'),
    home: document.getElementById('view-home'),
    map: document.getElementById('view-map'),
    add: document.getElementById('view-add'),
    detail: document.getElementById('view-detail'),
    register: document.getElementById('view-register'),
    settings: document.getElementById('view-settings')
};

// Map View DOM
const mapContainer = document.getElementById('map');
const inputMapSearch = document.getElementById('input-map-search');
const mapAutocompleteList = document.getElementById('map-autocomplete-list');
const mapBottomSheet = document.getElementById('map-bottom-sheet');
const sheetCafeName = document.getElementById('sheet-cafe-name');
const sheetCafeAddress = document.getElementById('sheet-cafe-address');
const btnSelectCafe = document.getElementById('btn-select-cafe');

const btnLoginGoogle = document.getElementById('btn-login-google');
const btnBack = document.getElementById('btn-back');
const headerTitle = document.getElementById('header-title');
const toastEl = document.getElementById('toast');

// Bottom Nav DOM
const bottomNav = document.getElementById('bottom-nav');
const navItems = document.querySelectorAll('.nav-item');

// Settings DOM
const settingsProfileImg = document.getElementById('settings-profile-img');
const settingsProfileName = document.getElementById('settings-profile-name');
const btnLogout = document.getElementById('btn-logout');

// Profile Setup DOM
const inputProfilePhoto = document.getElementById('input-profile-photo');
const previewProfilePhoto = document.getElementById('preview-profile-photo');
const placeholderProfilePhoto = document.getElementById('placeholder-profile-photo');
const inputProfileNickname = document.getElementById('input-profile-nickname');
const btnSubmitProfile = document.getElementById('btn-submit-profile');

// Inputs (Add Record)
const inputCafeName = document.getElementById('input-cafe-name');
const autocompleteAdd = document.getElementById('autocomplete-add');
const inputCafeMenu = document.getElementById('input-cafe-menu');
const inputReview = document.getElementById('input-review');
const inputMyPhoto = document.getElementById('input-my-photo');
const btnCameraMyPhoto = document.getElementById('btn-camera-my-photo');
const btnSubmit = document.getElementById('btn-submit');
const photoMyText = document.getElementById('photo-my-text');
const extractedMenuChips = document.getElementById('extracted-menu-chips');

// Inputs (Register Menu Sidebar)
const inputRegisterCafeName = document.getElementById('input-register-cafe-name');
const autocompleteRegister = document.getElementById('autocomplete-register');
const inputRegisterPhoto = document.getElementById('input-register-photo');
const labelRegisterPhoto = document.getElementById('label-register-photo');
const btnCameraRegisterPhoto = document.getElementById('btn-camera-register-photo');

// Inputs (Add View Mini OCR)
const btnCameraAddOcr = document.getElementById('btn-camera-add-ocr');
const inputAddOcr = document.getElementById('input-add-ocr');
const groupAddOcr = document.getElementById('group-add-ocr');
const loadingAddOcr = document.getElementById('loading-add-ocr');
const statusAddOcr = document.getElementById('add-ocr-status-text');

// Camera DOM
const cameraModal = document.getElementById('camera-modal');
const cameraVideo = document.getElementById('camera-video');
const cameraCanvas = document.getElementById('camera-canvas');
const btnCloseCamera = document.getElementById('btn-close-camera');
const btnCapture = document.getElementById('btn-capture');

// Camera State
let currentStream = null;
let cameraCallback = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const splash = document.getElementById('view-splash');
        const appContainer = document.getElementById('app-container');
        
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.classList.add('hidden');
            appContainer.classList.remove('hidden');
            appContainer.classList.add('fadeIn');
            
            setupEventListeners();
        }, 500);
    }, 2500);
});

// Navigation Function
function navigateTo(viewName, title = '한모금') {
    Object.values(views).forEach(view => {
        if(view) {
            view.classList.remove('active');
            view.classList.add('hidden');
        }
    });
    
    if(views[viewName]) {
        views[viewName].classList.remove('hidden');
        views[viewName].classList.add('active');
    }
    
    headerTitle.textContent = title;
    
    // Header Back button logic
    if (viewName === 'login' || viewName === 'profileSetup' || viewName === 'home' || viewName === 'settings') {
        btnBack.classList.add('hidden');
    } else {
        btnBack.classList.remove('hidden');
    }

    // Bottom Nav visibility & active state logic
    if (viewName === 'login' || viewName === 'profileSetup') {
        bottomNav.classList.add('hidden');
    } else {
        bottomNav.classList.remove('hidden');
        // Update active tab
        navItems.forEach(item => {
            if(item.dataset.target === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    if (viewName === 'home') {
        renderFeed();
    }
    
    if (viewName === 'map') {
        initKakaoMap();
    }
}

function showToast(message, duration = 3000) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    setTimeout(() => {
        toastEl.classList.add('hidden');
    }, duration);
}

// Sidebar functions removed

// Data Subscription
function subscribeToData(uid) {
    const userRef = doc(db, "users", uid);
    
    unsubCafes = onSnapshot(collection(userRef, "cafes"), (snapshot) => {
        cafes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(views.home.classList.contains('active')) renderFeed();
        if(views.detail.classList.contains('active')) renderDetail(document.getElementById('detail-cafe-name').dataset.cafeId);
    });

    const recordsQ = query(collection(userRef, "records"), orderBy("date", "desc"));
    unsubRecords = onSnapshot(recordsQ, (snapshot) => {
        records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(views.home.classList.contains('active')) renderFeed();
        if(views.detail.classList.contains('active')) renderDetail(document.getElementById('detail-cafe-name').dataset.cafeId);
    });

    unsubOcr = onSnapshot(collection(userRef, "ocr_menus"), (snapshot) => {
        extractedMenusByCafe = {};
        snapshot.docs.forEach(doc => {
            extractedMenusByCafe[doc.id] = doc.data().menus;
        });
    });
}

function unsubscribeData() {
    if(unsubCafes) unsubCafes();
    if(unsubRecords) unsubRecords();
    if(unsubOcr) unsubOcr();
    cafes = [];
    records = [];
    extractedMenusByCafe = {};
}

// Camera Functions
async function openCamera(callback) {
    cameraCallback = callback;
    cameraModal.classList.remove('hidden');
    try {
        currentStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
        cameraVideo.srcObject = currentStream;
    } catch (err) {
        console.error("Camera access denied or error", err);
        showToast('카메라 접근 권한이 필요합니다.');
        closeCamera();
    }
}

function closeCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    cameraVideo.srcObject = null;
    cameraModal.classList.add('hidden');
    cameraCallback = null;
}

// Event Listeners Setup
function setupEventListeners() {
    // Auth State Observer
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            
            // Check if profile exists
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists() && userDoc.data().nickname) {
                    // Profile exists
                    settingsProfileName.textContent = userDoc.data().nickname;
                    if(userDoc.data().profileImageUrl) {
                        settingsProfileImg.src = "data:image/jpeg;base64," + userDoc.data().profileImageUrl;
                    } else {
                        settingsProfileImg.src = "";
                    }

                    subscribeToData(user.uid);
                    navigateTo('home', '한모금');
                } else {
                    // Needs profile setup
                    navigateTo('profileSetup', '프로필 설정');
                }
            } catch (err) {
                console.error("Error fetching user profile", err);
                navigateTo('login', '한모금');
            }
        } else {
            currentUser = null;
            unsubscribeData();
            navigateTo('login', '한모금');
        }
    });

    // Login Action
    btnLoginGoogle.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => {
            console.error("Login failed:", error);
            showToast('로그인에 실패했습니다.');
        });
    });

    // Profile Setup Logic
    let base64ProfileImage = null;

    inputProfilePhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 300;
                
                // Square crop
                const size = Math.min(width, height);
                const startX = (width - size) / 2;
                const startY = (height - size) / 2;

                canvas.width = MAX_SIZE;
                canvas.height = MAX_SIZE;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, startX, startY, size, size, 0, 0, MAX_SIZE, MAX_SIZE);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                base64ProfileImage = dataUrl.split(',')[1];

                previewProfilePhoto.src = dataUrl;
                previewProfilePhoto.style.display = 'block';
                placeholderProfilePhoto.style.display = 'none';
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    inputProfileNickname.addEventListener('input', (e) => {
        btnSubmitProfile.disabled = e.target.value.trim().length === 0;
    });

    btnSubmitProfile.addEventListener('click', async () => {
        if(!currentUser) return;
        const nickname = inputProfileNickname.value.trim();
        if(!nickname) return;

        btnSubmitProfile.disabled = true;
        btnSubmitProfile.textContent = "저장 중...";

        try {
            const userRef = doc(db, "users", currentUser.uid);
            await setDoc(userRef, {
                nickname: nickname,
                profileImageUrl: base64ProfileImage || ""
            }, { merge: true });

            // Update UI
            settingsProfileName.textContent = nickname;
            if(base64ProfileImage) {
                settingsProfileImg.src = "data:image/jpeg;base64," + base64ProfileImage;
            }

            subscribeToData(currentUser.uid);
            showToast('환영합니다!');
            navigateTo('home', '한모금');
        } catch (error) {
            console.error("Profile save error:", error);
            showToast('저장에 실패했습니다.');
            btnSubmitProfile.disabled = false;
            btnSubmitProfile.textContent = "완료 및 시작하기";
        }
    });

    // Top Left Header Buttons
    btnBack.addEventListener('click', () => {
        navigateTo('home', '한모금');
        resetAddForm();
        resetRegisterForm();
    });

    // Bottom Navigation Logic
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetView = item.dataset.target;
            let title = '한모금';
            if (targetView === 'map') title = '카페 찾기';
            if (targetView === 'add') title = '기록하기';
            if (targetView === 'settings') title = '설정';
            
            navigateTo(targetView, title);
        });
    });

    // Settings Logout Logic
    btnLogout.addEventListener('click', () => {
        signOut(auth);
    });

    // Detail View FAB (Add record to this cafe)
    document.getElementById('btn-fab-detail').addEventListener('click', () => {
        const cafeName = document.getElementById('detail-cafe-name').textContent;
        inputCafeName.value = cafeName;
        inputCafeName.dispatchEvent(new Event('input')); // trigger menu chip loading
        navigateTo('add', '기록하기');
    });

    // -------- View: Register Menu (OCR) --------
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 1200;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl.split(',')[1]);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const processOcrRegistration = async (cafeName, fileOrBase64, isBase64 = false, isAddView = false) => {
        const loading = isAddView ? loadingAddOcr : document.getElementById('loading-ocr');
        const statusText = isAddView ? statusAddOcr : document.getElementById('ocr-status-text');
        const parentGroup = isAddView ? groupAddOcr : labelRegisterPhoto.parentElement;
        
        loading.classList.remove('hidden');
        parentGroup.classList.add('hidden');

        try {
            statusText.innerHTML = `AI가 메뉴를 분석하고 있어요...<br><span style="font-size:0.8rem; color:var(--text-secondary)">(약 5~10초 소요)</span>`;
            
            let base64Image = fileOrBase64;
            if (!isBase64) {
                statusText.innerHTML = `사진 최적화 중...<br><span style="font-size:0.8rem; color:var(--text-secondary)">(초고속 압축 중)</span>`;
                base64Image = await compressImage(fileOrBase64);
            }
            
            statusText.innerHTML = `AI가 메뉴를 분석하고 있어요...<br><span style="font-size:0.8rem; color:var(--text-secondary)">(약 5~10초 소요)</span>`;
            
            const response = await fetch('/api/extract-menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: base64Image,
                    mimeType: 'image/jpeg'
                })
            });

            let data;
            try {
                data = await response.json();
            } catch(e) {
                throw new Error('서버 에러 (설정 오류 혹은 용량 초과)');
            }

            if (!response.ok) {
                throw new Error(data.error || 'Server error');
            }

            const menusToSave = data.menus || [];
            
            if (menusToSave.length > 0) {
                // Save to Firestore
                if (currentUser) {
                    await setDoc(doc(db, "users", currentUser.uid, "ocr_menus", cafeName), {
                        menus: menusToSave
                    });
                }
                showToast(`'${cafeName}'의 메뉴가 추출되었습니다!`);
                if (isAddView) {
                    inputCafeName.dispatchEvent(new Event('input'));
                }
            } else {
                showToast('메뉴를 찾지 못했습니다. 다시 시도해주세요.');
            }
            
            loading.classList.add('hidden');
            parentGroup.classList.remove('hidden');
            
            if (!isAddView) {
                resetRegisterForm();
                navigateTo('home', '한모금');
            }

        } catch (error) {
            console.error(error);
            showToast(`실패: ${error.message}`);
            loading.classList.add('hidden');
            parentGroup.classList.remove('hidden');
            if (!isAddView) resetRegisterForm();
        }
    };

    // Prevent clicking upload if name is empty
    labelRegisterPhoto.addEventListener('click', (e) => {
        const cafeName = inputRegisterCafeName.value.trim();
        if(cafeName === '') {
            e.preventDefault();
            showToast('카페 이름을 먼저 입력해주세요!');
            inputRegisterCafeName.focus();
        }
    });

    inputRegisterPhoto.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const cafeName = inputRegisterCafeName.value.trim();
        await processOcrRegistration(cafeName, file, false);
    });

    // Camera Capture for Register Menu
    btnCameraRegisterPhoto.addEventListener('click', () => {
        const cafeName = inputRegisterCafeName.value.trim();
        if(cafeName === '') {
            showToast('카페 이름을 먼저 입력해주세요!');
            inputRegisterCafeName.focus();
            return;
        }
        
        openCamera(async (base64Image) => {
            await processOcrRegistration(cafeName, base64Image, true, false);
        });
    });

    // -------- View: Add Record Mini OCR --------
    inputAddOcr.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const cafeName = inputCafeName.value.trim();
        if(cafeName === '') {
            showToast('카페 이름을 먼저 입력해주세요!');
            inputCafeName.focus();
            inputAddOcr.value = '';
            return;
        }
        await processOcrRegistration(cafeName, file, false, true);
        inputAddOcr.value = '';
    });

    btnCameraAddOcr.addEventListener('click', () => {
        const cafeName = inputCafeName.value.trim();
        if(cafeName === '') {
            showToast('카페 이름을 먼저 입력해주세요!');
            inputCafeName.focus();
            return;
        }
        
        openCamera(async (base64Image) => {
            await processOcrRegistration(cafeName, base64Image, true, true);
        });
    });

    // -------- Camera Modal Controls --------
    btnCloseCamera.addEventListener('click', closeCamera);

    btnCapture.addEventListener('click', () => {
        if (!currentStream) return;
        
        const MAX_SIZE = 1200;
        let width = cameraVideo.videoWidth;
        let height = cameraVideo.videoHeight;
        
        if (width > height) {
            if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            }
        } else {
            if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }
        }
        
        cameraCanvas.width = width;
        cameraCanvas.height = height;
        const ctx = cameraCanvas.getContext('2d');
        ctx.drawImage(cameraVideo, 0, 0, width, height);
        
        const fullDataUrl = cameraCanvas.toDataURL('image/jpeg', 0.8);
        const base64Image = fullDataUrl.split(',')[1];
        
        if (cameraCallback) {
            cameraCallback(base64Image, fullDataUrl);
        }
        closeCamera();
    });

    // -------- View: Add Record --------
    const validateForm = () => {
        const hasName = inputCafeName.value.trim().length > 0;
        const hasMenu = inputCafeMenu.value.trim().length > 0;
        const hasReview = inputReview.value.trim().length > 0;
        btnSubmit.disabled = !(hasName && hasMenu && hasReview);
    };

    inputCafeName.addEventListener('input', (e) => {
        validateForm();
        const typedName = e.target.value.trim();
        
        extractedMenuChips.innerHTML = '';
        extractedMenuChips.classList.add('hidden');

        if(typedName && extractedMenusByCafe[typedName]) {
            const menus = extractedMenusByCafe[typedName];
            menus.forEach(menuStr => {
                const safeMenu = menuStr.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const chip = document.createElement('div');
                chip.className = 'menu-chip';
                chip.textContent = safeMenu;
                
                chip.addEventListener('click', () => {
                    inputCafeMenu.value = chip.textContent;
                    validateForm();
                });

                extractedMenuChips.appendChild(chip);
            });
            extractedMenuChips.classList.remove('hidden');
        }
    });

    inputCafeMenu.addEventListener('input', validateForm);
    inputReview.addEventListener('input', validateForm);

    inputMyPhoto.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            photoMyText.textContent = "사진 첨부 완료";
            photoMyText.style.color = "var(--accent-color)";
        } else {
            photoMyText.textContent = "사진 업로드";
            photoMyText.style.color = "var(--text-secondary)";
        }
    });

    btnCameraMyPhoto.addEventListener('click', () => {
        openCamera((base64Image) => {
            photoMyText.textContent = "촬영 완료";
            photoMyText.style.color = "var(--accent-color)";
        });
    });

    // Submit Logic
    btnSubmit.addEventListener('click', async () => {
        if(!currentUser) return;

        const typedCafeName = inputCafeName.value.trim();
        
        let existingCafe = cafes.find(c => c.name === typedCafeName);
        if(!existingCafe) {
            // Add Cafe to Firestore
            const newCafeRef = doc(collection(db, "users", currentUser.uid, "cafes"));
            await setDoc(newCafeRef, { name: typedCafeName });
            existingCafe = { id: newCafeRef.id, name: typedCafeName };
        }

        const newRecord = {
            cafeId: existingCafe.id,
            menu: inputCafeMenu.value.trim(),
            review: inputReview.value.trim(),
            date: new Date().toISOString()
        };
        
        // Add Record to Firestore
        await addDoc(collection(db, "users", currentUser.uid, "records"), newRecord);
        
        resetAddForm();
        showToast('성공적으로 기록되었습니다!', 2000);
        navigateTo('home', '한모금');
    });

    // Setup Kakao Autocomplete
    setupKakaoAutocomplete(inputCafeName, autocompleteAdd);
    setupKakaoAutocomplete(inputRegisterCafeName, autocompleteRegister);
}

function resetAddForm() {
    inputCafeName.value = '';
    inputCafeMenu.value = '';
    inputReview.value = '';
    inputMyPhoto.value = '';
    inputAddOcr.value = '';
    photoMyText.textContent = "사진 업로드";
    photoMyText.style.color = "var(--text-secondary)";
    extractedMenuChips.innerHTML = '';
    extractedMenuChips.classList.add('hidden');
    btnSubmit.disabled = true;
}

function resetRegisterForm() {
    inputRegisterCafeName.value = '';
    inputRegisterPhoto.value = '';
    document.getElementById('loading-ocr').classList.add('hidden');
    if (labelRegisterPhoto.parentElement) {
        labelRegisterPhoto.parentElement.classList.remove('hidden');
    }
}

// Render Feed
function renderFeed() {
    const emptyState = document.getElementById('empty-state');
    const feedList = document.getElementById('feed-list');
    
    feedList.innerHTML = '';

    if(cafes.length === 0) {
        emptyState.classList.remove('hidden');
        feedList.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    feedList.classList.remove('hidden');

    cafes.forEach(cafe => {
        const cafeRecords = records.filter(r => r.cafeId === cafe.id);
        if(cafeRecords.length > 0) {
            const card = document.createElement('div');
            card.className = 'cafe-card';
            card.style.position = 'relative';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                    <h3 style="margin:0;">${cafe.name}</h3>
                    <div style="position:relative;">
                        <button class="btn-more-menu icon-btn" style="color:var(--text-secondary); margin-top:-2px; margin-right:-5px;" aria-label="메뉴">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                        <div class="action-dropdown hidden" style="position:absolute; top:35px; right:0; background:#2a2321; border:1px solid var(--glass-border); border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.6); z-index:20; min-width:110px; overflow:hidden;">
                            <button class="btn-action-delete" style="background:transparent; color:#ff4d4d; border:none; padding:12px 16px; font-size:0.95rem; width:100%; text-align:left; cursor:pointer; display:flex; align-items:center; gap:8px;">
                                <i class="fa-solid fa-trash-can"></i>삭제하기
                            </button>
                        </div>
                    </div>
                </div>
                <p style="margin:0;">나의 한모금이 ${cafeRecords.length}번 쌓여있습니다.</p>
            `;
            
            const moreMenuBtn = card.querySelector('.btn-more-menu');
            const actionDropdown = card.querySelector('.action-dropdown');
            const deleteBtn = card.querySelector('.btn-action-delete');

            moreMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.action-dropdown').forEach(d => {
                    if (d !== actionDropdown) d.classList.add('hidden');
                });
                actionDropdown.classList.toggle('hidden');
            });

            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                actionDropdown.classList.add('hidden');
                try {
                    await deleteDoc(doc(db, "users", currentUser.uid, "cafes", cafe.id));
                    cafeRecords.forEach(async (r) => {
                        await deleteDoc(doc(db, "users", currentUser.uid, "records", r.id));
                    });
                    showToast(`'${cafe.name}' 기록이 삭제되었습니다.`);
                } catch(err) {
                    console.error(err);
                    showToast('삭제 중 오류가 발생했습니다.');
                }
            });

            card.addEventListener('click', () => {
                document.getElementById('detail-cafe-name').dataset.cafeId = cafe.id;
                renderDetail(cafe.id);
                navigateTo('detail', cafe.name);
            });
            feedList.appendChild(card);
        }
    });
}

// Render Detail View
function renderDetail(cafeId) {
    if(!cafeId) return;
    const cafe = cafes.find(c => c.id === cafeId);
    if(!cafe) return;

    const cafeRecords = records.filter(r => r.cafeId === cafeId).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    document.getElementById('detail-cafe-name').textContent = cafe.name;
    document.getElementById('detail-cafe-count').textContent = `총 ${cafeRecords.length}번 방문했어요`;

    const timeline = document.getElementById('detail-timeline');
    timeline.innerHTML = '';
    
    cafeRecords.forEach(record => {
        const dateObj = new Date(record.date);
        const dateStr = `${dateObj.getMonth()+1}월 ${dateObj.getDate()}일`;
        
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-date">${dateStr}</div>
                <div class="timeline-menu">${record.menu}</div>
                <div class="timeline-review">"${record.review}"</div>
            </div>
        `;
        timeline.appendChild(item);
    });
}
// Sidebar fully removed

// -------- Kakao Local Search Autocomplete --------
function setupKakaoAutocomplete(inputElement, listElement) {
    let timeoutId;
    inputElement.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        listElement.innerHTML = '';
        if (query.length === 0) {
            listElement.classList.add('hidden');
            return;
        }

        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
            try {
                // category_group_code=CE7 (카페 카테고리)
                const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&category_group_code=CE7`, {
                    headers: { 'Authorization': 'KakaoAK f4d2679734cea10d3450794d609c4527' }
                });
                const data = await res.json();
                
                listElement.innerHTML = '';
                if (data.documents && data.documents.length > 0) {
                    listElement.classList.remove('hidden');
                    data.documents.forEach(place => {
                        const li = document.createElement('li');
                        li.innerHTML = `${place.place_name} <span class="address">${place.address_name}</span>`;
                        li.addEventListener('click', () => {
                            inputElement.value = place.place_name;
                            listElement.classList.add('hidden');
                            inputElement.dispatchEvent(new Event('input')); // trigger validations & ocr chips
                        });
                        listElement.appendChild(li);
                    });
                } else {
                    listElement.classList.add('hidden');
                }
            } catch(err) {
                console.error("Kakao API Error:", err);
            }
        }, 300); // 0.3s debounce
    });

    // Hide when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target !== inputElement && !listElement.contains(e.target)) {
            listElement.classList.add('hidden');
        }
    });
}

// -------- Kakao Map Search Logic --------
let kakaoMap = null;
let ps = null;
let mapMarkers = [];
let mapInfoWindow = null;
let selectedCafeData = null;

function initKakaoMap() {
    if (kakaoMap) {
        kakaoMap.relayout();
        return;
    }
    
    if (!window.kakao || !window.kakao.maps) {
        console.warn("Kakao Map SDK not loaded yet.");
        setTimeout(initKakaoMap, 500);
        return;
    }

    const options = {
        center: new kakao.maps.LatLng(37.566826, 126.9786567), // Default: Seoul
        level: 3
    };
    
    kakaoMap = new kakao.maps.Map(mapContainer, options);
    ps = new kakao.maps.services.Places();
    mapInfoWindow = new kakao.maps.InfoWindow({zIndex:1, disableAutoPan: true});

    // Try HTML5 Geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const locPosition = new kakao.maps.LatLng(lat, lon);
            kakaoMap.setCenter(locPosition);
        }, (err) => {
            console.log("Geolocation blocked or failed.");
        });
    }
    
    setupMapSearchListeners();
}

function setupMapSearchListeners() {
    let timeoutId;
    
    inputMapSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        mapAutocompleteList.innerHTML = '';
        mapBottomSheet.classList.remove('show');
        
        if (query.length === 0) {
            mapAutocompleteList.classList.add('hidden');
            removeMapMarkers();
            return;
        }

        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            // Use Places API to search around center
            ps.keywordSearch(query, placesSearchCB, {
                category_group_code: 'CE7',
                location: kakaoMap.getCenter(),
                radius: 5000 // 5km radius
            });
        }, 300);
    });
    
    btnSelectCafe.addEventListener('click', () => {
        if (!selectedCafeData) return;
        
        // Move to Add view
        inputCafeName.value = selectedCafeData.place_name;
        inputCafeName.dispatchEvent(new Event('input')); // trigger menu chip loading
        navigateTo('add', '기록하기');
        mapBottomSheet.classList.remove('show');
    });
    
    // Hide bottom sheet on map click
    kakao.maps.event.addListener(kakaoMap, 'click', function() {
        mapBottomSheet.classList.remove('show');
        mapInfoWindow.close();
    });
}

function placesSearchCB(data, status, pagination) {
    if (status === kakao.maps.services.Status.OK) {
        displayMapPlaces(data);
    } else {
        mapAutocompleteList.classList.add('hidden');
        removeMapMarkers();
    }
}

function displayMapPlaces(places) {
    mapAutocompleteList.innerHTML = '';
    mapAutocompleteList.classList.remove('hidden');
    removeMapMarkers();

    const bounds = new kakao.maps.LatLngBounds();

    places.forEach((place, i) => {
        const placePosition = new kakao.maps.LatLng(place.y, place.x);
        const marker = new kakao.maps.Marker({
            map: kakaoMap,
            position: placePosition
        });
        mapMarkers.push(marker);

        bounds.extend(placePosition);

        // List item
        const li = document.createElement('li');
        li.innerHTML = `${place.place_name} <span class="address">${place.road_address_name || place.address_name}</span>`;
        
        const clickHandler = () => {
            selectedCafeData = place;
            sheetCafeName.textContent = place.place_name;
            sheetCafeAddress.textContent = place.road_address_name || place.address_name;
            
            mapAutocompleteList.classList.add('hidden');
            kakaoMap.setCenter(placePosition);
            kakaoMap.setLevel(3);
            
            const infoHtml = `
                <div style="padding:10px; font-size:14px; text-align:center; min-width: 150px; background: white;">
                    <div style="font-weight:bold; margin-bottom: 8px; color: #333;">${place.place_name}</div>
                    <button onclick="window.selectCafeFromMap()" style="background:var(--accent-color); color:white; border:none; padding:8px 14px; border-radius:6px; cursor:pointer; font-weight:600; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">카페 등록하기 &gt;</button>
                </div>
            `;
            mapInfoWindow.setContent(infoHtml);
            mapInfoWindow.open(kakaoMap, marker);
            
            mapBottomSheet.classList.add('show');
        };
        
        li.addEventListener('click', clickHandler);
        mapAutocompleteList.appendChild(li);

        // Marker click
        kakao.maps.event.addListener(marker, 'click', clickHandler);
    });

    kakaoMap.setBounds(bounds);
}

window.selectCafeFromMap = function() {
    if (!selectedCafeData) return;
    inputCafeName.value = selectedCafeData.place_name;
    inputCafeName.dispatchEvent(new Event('input')); // trigger menu chip loading
    navigateTo('add', '기록하기');
    mapBottomSheet.classList.remove('show');
    mapInfoWindow.close();
};

function removeMapMarkers() {
    mapMarkers.forEach(marker => marker.setMap(null));
    mapMarkers = [];
    mapInfoWindow.close();
}
