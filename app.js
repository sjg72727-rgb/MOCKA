// Memory Data
let cafes = [];
let records = [];

// Option B OCR State
// Structure: { "스타벅스": ["아메리카노", "라떼", "프라푸치노"], ... }
let extractedMenusByCafe = {};

// DOM Elements
const views = {
    home: document.getElementById('view-home'),
    add: document.getElementById('view-add'),
    detail: document.getElementById('view-detail'),
    register: document.getElementById('view-register')
};

const btnBack = document.getElementById('btn-back');
const btnMenu = document.getElementById('btn-menu');
const headerTitle = document.getElementById('header-title');
const toastEl = document.getElementById('toast');

// Sidebar DOM
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const navRegisterMenu = document.getElementById('nav-register-menu');

// Inputs (Add Record)
const inputCafeName = document.getElementById('input-cafe-name');
const inputCafeMenu = document.getElementById('input-cafe-menu');
const inputReview = document.getElementById('input-review');
const inputMyPhoto = document.getElementById('input-my-photo');
const btnCameraMyPhoto = document.getElementById('btn-camera-my-photo');
const btnSubmit = document.getElementById('btn-submit');
const photoMyText = document.getElementById('photo-my-text');
const extractedMenuChips = document.getElementById('extracted-menu-chips');

// Inputs (Register Menu Sidebar)
const inputRegisterCafeName = document.getElementById('input-register-cafe-name');
const inputRegisterPhoto = document.getElementById('input-register-photo');
const labelRegisterPhoto = document.getElementById('label-register-photo');
const btnCameraRegisterPhoto = document.getElementById('btn-camera-register-photo');

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
            
            renderFeed();
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
    
    if (viewName === 'home') {
        btnBack.classList.add('hidden');
        btnMenu.classList.remove('hidden');
        renderFeed();
    } else {
        btnBack.classList.remove('hidden');
        btnMenu.classList.add('hidden');
    }
}

function showToast(message, duration = 3000) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    setTimeout(() => {
        toastEl.classList.add('hidden');
    }, duration);
}

// Sidebar Functions
function openSidebar() {
    sidebarOverlay.classList.remove('hidden');
    setTimeout(() => sidebar.classList.remove('closed'), 10);
}
function closeSidebar() {
    sidebar.classList.add('closed');
    setTimeout(() => sidebarOverlay.classList.add('hidden'), 300);
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
    // Top Left Header Buttons
    btnBack.addEventListener('click', () => {
        navigateTo('home', '한모금');
        resetAddForm();
        resetRegisterForm();
    });

    btnMenu.addEventListener('click', openSidebar);
    btnCloseSidebar.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // Sidebar Menu Click -> Go to Register View
    navRegisterMenu.addEventListener('click', () => {
        closeSidebar();
        setTimeout(() => {
            navigateTo('register', '메뉴판 등록하기');
        }, 300);
    });

    // FAB (+) Button Click -> Go to Add View
    document.getElementById('btn-fab').addEventListener('click', () => {
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

    const processOcrRegistration = async (cafeName, fileOrBase64, isBase64 = false) => {
        const loading = document.getElementById('loading-ocr');
        const statusText = document.getElementById('ocr-status-text');
        
        loading.classList.remove('hidden');
        labelRegisterPhoto.parentElement.classList.add('hidden'); // Hide the photo-action-group

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
                extractedMenusByCafe[cafeName] = menusToSave;
                showToast(`'${cafeName}'의 메뉴가 등록되었습니다!`);
            } else {
                showToast('메뉴를 찾지 못했습니다. 다시 시도해주세요.');
            }
            
            resetRegisterForm();
            navigateTo('home', '한모금');

        } catch (error) {
            console.error(error);
            showToast(`실패: ${error.message}`);
            resetRegisterForm();
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
            await processOcrRegistration(cafeName, base64Image, true);
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
    btnSubmit.addEventListener('click', () => {
        const typedCafeName = inputCafeName.value.trim();
        
        let existingCafe = cafes.find(c => c.name === typedCafeName);
        if(!existingCafe) {
            existingCafe = { id: Date.now().toString(), name: typedCafeName };
            cafes.push(existingCafe);
        }

        const newRecord = {
            id: Date.now(),
            cafeId: existingCafe.id,
            menu: inputCafeMenu.value.trim(),
            review: inputReview.value.trim(),
            date: new Date().toISOString()
        };
        
        records.unshift(newRecord);
        
        resetAddForm();
        showToast('성공적으로 기록되었습니다!', 2000);
        navigateTo('home', '한모금');
    });
}

function resetAddForm() {
    inputCafeName.value = '';
    inputCafeMenu.value = '';
    inputReview.value = '';
    inputMyPhoto.value = '';
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
            card.innerHTML = `
                <h3>${cafe.name}</h3>
                <p>나의 한모금이 ${cafeRecords.length}번 쌓여있습니다.</p>
            `;
            card.addEventListener('click', () => {
                renderDetail(cafe.id);
                navigateTo('detail', cafe.name);
            });
            feedList.appendChild(card);
        }
    });
}

// Render Detail View
function renderDetail(cafeId) {
    const cafe = cafes.find(c => c.id === cafeId);
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
// Set initial sidebar state
document.getElementById('sidebar').classList.add('closed');
