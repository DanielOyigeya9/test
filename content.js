// Modified mining button handler
mineBtn.addEventListener('click', async () => {
    if (isConnecting) return;
    
    if (!isMining) {
        // Start connecting sequence
        isConnecting = true;
        mineBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CONNECTING';
        mineBtn.classList.add('connecting');
        connectionStatus.textContent = 'Establishing connection...';
        
        try {
            // Call the Python backend to start mining
            const response = await fetch('http://localhost:5000/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            console.log(data);
            
            if (data.status === 'connecting') {
                isConnecting = false;
                isMining = true;
                mineBtn.innerHTML = '<i class="fas fa-power-off"></i> DISCONNECT';
                mineBtn.classList.remove('connecting');
                mineBtn.classList.add('active');
                miningStatus.innerHTML = '<i class="fas fa-circle" style="color: #00ff55;"></i> Status: CONNECTED';
                
                // Start polling for mining status
                updateMiningStatus();
            }
        } catch (error) {
            console.error('Error connecting:', error);
            isConnecting = false;
            mineBtn.innerHTML = '<i class="fas fa-power-off"></i> CONNECT';
            mineBtn.classList.remove('connecting');
            connectionStatus.textContent = 'Connection failed';
        }
    } else {
        // Disconnect
        try {
            const response = await fetch('http://localhost:5000/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            console.log(data);
            
            isMining = false;
            mineBtn.innerHTML = '<i class="fas fa-power-off"></i> CONNECT';
            mineBtn.classList.remove('active');
            miningStatus.innerHTML = '<i class="fas fa-circle" style="color: #ff5555;"></i> Status: OFFLINE';
            connectionStatus.textContent = '';
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    }
});

// Function to update mining status
async function updateMiningStatus() {
    if (!isMining) return;
    
    try {
        const response = await fetch('http://localhost:5000/status');
        const data = await response.json();
        
        if (data.is_mining) {
            // Update UI with mining stats
            const speedPercent = (data.mining_speed * 100).toFixed(0);
            const unusedMbps = (data.bandwidth.unused / 12500).toFixed(2);
            connectionStatus.textContent = `Mining at ${speedPercent}% speed (${unusedMbps} Mbps unused)`;
            
            // Update earnings based on last mining activity
            if (data.last_mining) {
                earnings += parseFloat(data.last_mining.amount);
                earningsDisplay.textContent = earnings.toFixed(2) + ' $DUB';
            }
            
            // Update graph periodically
            if (Date.now() - lastUpdateTime > 5000) {
                updateGraph();
                lastUpdateTime = Date.now();
            }
        }
        
        // Continue polling
        setTimeout(updateMiningStatus, 1000);
    } catch (error) {
        console.error('Error getting mining status:', error);
        setTimeout(updateMiningStatus, 5000); // Retry after delay
    }
}

// Task completion handlers
extensionBtn.addEventListener('click', async function() {
    if (!activeBoosts.extension) {
        try {
            const response = await fetch('http://localhost:5000/complete_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ task: 'extension' })
            });
            
            const data = await response.json();
            alert(data.message);
            
            activeBoosts.extension = true;
            this.innerHTML = '<i class="fas fa-check"></i> Connected';
            this.classList.add('connected');
        } catch (error) {
            console.error('Error completing extension task:', error);
        }
    }
});

telegramBtn.addEventListener('click', async function() {
    if (!activeBoosts.telegram) {
        try {
            const response = await fetch('http://localhost:5000/complete_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ task: 'telegram' })
            });
            
            const data = await response.json();
            alert(data.message);
            
            activeBoosts.telegram = true;
            this.innerHTML = '<i class="fas fa-check"></i> Connected';
            this.classList.add('connected');
        } catch (error) {
            console.error('Error completing telegram task:', error);
        }
    }
});

desktopBtn.addEventListener('click', async function() {
    if (!activeBoosts.desktop) {
        try {
            const response = await fetch('http://localhost:5000/complete_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ task: 'desktop' })
            });
            
            const data = await response.json();
            alert(data.message);
            
            activeBoosts.desktop = true;
            this.innerHTML = '<i class="fas fa-check"></i> Connected';
            this.classList.add('connected');
        } catch (error) {
            console.error('Error completing desktop task:', error);
        }
    }
});