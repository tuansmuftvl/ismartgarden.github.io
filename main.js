import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD_9uOZ1W1MRl4xVFSgJPupC3YupEkRJh8",
    authDomain: "garden-monitori.firebaseapp.com",
    databaseURL: "https://garden-monitori-default-rtdb.firebaseio.com",
    projectId: "garden-monitori",
    storageBucket: "garden-monitori.firebasestorage.app",
    messagingSenderId: "193308209488",
    appId: "1:193308209488:web:c313aa0e229cb4f05ebc55",
    measurementId: "G-3F500Q9VG1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const nodes = ["Node1", "Node2", "Node3", "Node4"];

function createNodeUI(nodeName) {
    const container = document.createElement("div");
    container.className = "node";
    container.id = nodeName;  // Thiết lập ID riêng cho mỗi node
    container.innerHTML = `
        <h2>${nodeName}</h2>
        <div class="data-display">
            <p><i class="material-icons" style="color: red">thermostat</i>Nhiệt độ: <span id="temp-${nodeName}">Loading...</span> °C</p>
            <p><i class="material-icons" style="color: #1E90FF">water_drop</i>Độ ẩm: <span id="humid-${nodeName}">Loading...</span> %</p>
            <p><i class="material-icons" style="color: brown;">terrain</i>Độ ẩm đất: <span id="somo-${nodeName}">Loading...</span>%</p>
        </div>
    `;
    document.getElementById("nodes").appendChild(container);
}

function createChartUI(nodeName) {
    const container = document.createElement("div");
    container.className = "chart-container";
    container.innerHTML = `
        <h3>${nodeName}</h3>
        <canvas id="chart-${nodeName}"></canvas>
    `;
    document.getElementById("charts").appendChild(container);
}

function updateNodeData(nodeName, data) {
    document.getElementById(`temp-${nodeName}`).textContent = data.temp || "N/A";
    document.getElementById(`humid-${nodeName}`).textContent = data.humid || "N/A";
    document.getElementById(`somo-${nodeName}`).textContent = data.somo || "N/A";
}

function createChart(nodeName) {
    const ctx = document.getElementById(`chart-${nodeName}`).getContext("2d");
    const chartData = {
        labels: [],
        datasets: [
            {
                label: "Nhiệt độ (°C)",
                data: [],
                borderColor: "red",
                fill: false,
            },
            {
                label: "Độ ẩm (%)",
                data: [],
                borderColor: "blue",
                fill: false,
            },
            {
                label: "Độ ẩm đất (%)",
                data: [],
                borderColor: "green",
                fill: false,
            },
        ],
    };

    const chart = new Chart(ctx, {
        type: "line",
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || "";
                            const value = context.raw;
                            const time = new Date(chartData.labels[context.dataIndex]).toLocaleString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                            });
                            return `${label}: ${value} (${time})`;
                        },
                    },
                },
                
            },
            scales: {
                x: {
                    ticks: {
                        callback: function (value, index, values) {
                            const date = new Date(chartData.labels[index]);
                            return date.toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                            });
                        },
                    },
                },
            },            
        },
    });

    return chart;
}

// Tạo giao diện cho các node và biểu đồ
nodes.forEach((node) => {
    createNodeUI(node);
    createChartUI(node);

    const chart = createChart(node);
    const dbRef = ref(database, node);

    onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
            const nodeData = snapshot.val();
            const timestamps = Object.keys(nodeData).sort((a, b) => b - a);
            const latestTimestamps = timestamps.slice(0, 20).reverse();

            const labels = latestTimestamps.map((ts) => new Date(Number(ts) * 1000).toISOString());
            const tempData = [];
            const humidData = [];
            const somoData = [];

            latestTimestamps.forEach((ts) => {
                const entry = nodeData[ts];
                tempData.push(entry.temp || 0);
                humidData.push(entry.humid || 0);
                somoData.push(entry.somo || 0);
            });

            chart.data.labels = labels;
            chart.data.datasets[0].data = tempData;
            chart.data.datasets[1].data = humidData;
            chart.data.datasets[2].data = somoData;
            chart.update();

            const latestData = nodeData[latestTimestamps[latestTimestamps.length - 1]];
            updateNodeData(node, {
                temp: latestData.temp || "N/A",
                humid: latestData.humid || "N/A",
                somo: latestData.somo || "N/A",
            });
        }
    });
});

// Điều khiển bơm
const pumpFlowInput = document.getElementById("pump-flow");
const pumpFlowValue = document.getElementById("pump-flow-value");
const pumpDurationInput = document.getElementById("pump-duration");
const pumpOnButton = document.getElementById("pump-on");
const pumpOffButton = document.getElementById("pump-off");
const pumpDurationDisplay = document.getElementById("pump-duration-value");

const cancelScheduleButton = document.getElementById("cancel-schedule");

let scheduledCountdownInterval = null;  // Đảm bảo biến đếm ngược cho việc hẹn giờ là toàn cục
let scheduledRemainingTime = 0;  // Thời gian còn lại cho việc hẹn giờ

let countdownInterval = null;
let remainingTime = 0;

pumpFlowInput.addEventListener("input", () => {
    pumpFlowValue.textContent = pumpFlowInput.value;
});

pumpOnButton.addEventListener("click", () => {
    const flowValue = parseInt(pumpFlowInput.value, 10)/50*100;
    const durationValue = parseInt(pumpDurationInput.value, 10);

    if (durationValue <= 0) {
        alert("Thời gian bơm không hợp lệ.");
        return;
    }
    if (isNaN(durationValue)) {
        alert("Chưa nhập thời gian bơm.");
        return;
    }

    set(ref(database, "pump"), {
        flow: flowValue,
        pump_event: 1,
    });


    // Bắt đầu đếm ngược ngay khi nhấn ON
    remainingTime = durationValue * 60;  // Chuyển đổi phút thành giây
    updatePumpDurationDisplay();  // Cập nhật giá trị hiển thị

    // Đặt bộ đếm ngược
    countdownInterval = setInterval(() => {
        if (remainingTime > 0) {
            remainingTime--;
            updatePumpDurationDisplay();
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            set(ref(database, "pump/pump_event"), 0); // Tắt bơm sau khi hết thời gian
        }
    }, 1000);  // Chạy bộ đếm ngược mỗi giây
});


pumpOffButton.addEventListener("click", () => {
    clearInterval(countdownInterval);
    countdownInterval = null;
    remainingTime = 0;
    updatePumpDurationDisplay();

    set(ref(database, "pump/pump_event"), 0);
});

function updatePumpDurationDisplay() {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    pumpDurationDisplay.textContent = `${minutes} phút ${seconds} giây`;
}


const scheduledFlowInput = document.getElementById("scheduled-flow");
const scheduledFlowValue = document.getElementById("scheduled-flow-value");
const startHourInput = document.getElementById("start-hour");
const startMinuteInput = document.getElementById("start-minute");
const startSecondInput = document.getElementById("start-second");
const scheduleDurationInput = document.getElementById("schedule-duration");
const schedulePumpButton = document.getElementById("schedule-pump");

scheduledFlowInput.addEventListener("input", () => {
    scheduledFlowValue.textContent = scheduledFlowInput.value;
});

schedulePumpButton.addEventListener("click", () => {
    const flowValue = parseInt(scheduledFlowInput.value, 10) / 50 * 100;
    const durationValue = parseInt(scheduleDurationInput.value, 10);
    const startHour = parseInt(startHourInput.value, 10);
    const startMinute = parseInt(startMinuteInput.value, 10);
    const startSecond = parseInt(startSecondInput.value, 10);

    // Kiểm tra giá trị nhập vào
    if (isNaN(durationValue) || durationValue <= 0) {
        alert("Thời gian bơm không hợp lệ.");
        return;
    }
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(startSecond)) {
        alert("Thời gian bắt đầu không hợp lệ.");
        return;
    }

    const now = new Date();
    const startTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        startHour,
        startMinute,
        startSecond
    );

    // Kiểm tra thời gian bắt đầu phải sau thời gian hiện tại
    if (startTime <= now) {
        alert("Thời gian bắt đầu phải lớn hơn thời gian hiện tại.");
        return;
    }

    const delay = startTime - now;  // Tính thời gian chờ đến khi bật bơm

    // Đặt hẹn giờ để bật bơm khi đến giờ
    setTimeout(() => {
        set(ref(database, "pump"), {
            flow: flowValue,
            pump_event: 1,  // Bật bơm khi đến giờ
        });

        // Tính thời gian bơm sẽ chạy, đổi phút thành giây
        const durationInSeconds = durationValue * 60;

        // Sau khi bật bơm, hẹn giờ tắt bơm sau durationInSeconds giây
        setTimeout(() => {
            set(ref(database, "pump/pump_event"), 0);  // Tắt bơm sau thời gian durationValue phút
        }, durationInSeconds * 1000);  // durationInSeconds * 1000 để chuyển từ giây sang mili giây

    }, delay);  // Delay để bật bơm vào thời gian startTime

    alert(`Hẹn giờ bơm thành công! Bơm sẽ bắt đầu vào ${startHour}:${startMinute}:${startSecond} và tắt sau ${durationValue} phút.`);
});



cancelScheduleButton.addEventListener("click", () => {
    // Hủy bỏ bộ đếm ngược nếu nó đang chạy
    if (scheduledCountdownInterval) {
        clearInterval(scheduledCountdownInterval);
        scheduledCountdownInterval = null;
    }

    // Cập nhật Firebase để tắt bơm
    set(ref(database, "pump/pump_event"), 0);

    // Cập nhật giao diện người dùng, có thể thay đổi thời gian còn lại thành 0 hoặc không hiển thị
    alert("Hủy hẹn giờ bơm thành công!");

    // Bạn có thể thêm logic để reset các trường nhập liệu nếu cần
    // Ví dụ: Đặt lại các trường thời gian nhập liệu về mặc định
    startHourInput.value = '';
    startMinuteInput.value = '';
    startSecondInput.value = '';
    scheduleDurationInput.value = '';
});
