console.log("Script file successfully loaded!");

async function generateExcuse() {
    console.log("Button was clicked! Fetching excuse...");
    const name = document.getElementById('username').value.trim();
    if (!name) return alert('Please enter a name first.');

    const excuseBox = document.getElementById('excuseBox');
    const history = document.getElementById('history');

    try {
        const response = await fetch('https://excuse-generator-backend.onrender.com/api/excuse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const data = await response.json();
        
        if (data.error) {
            alert('Server error: ' + data.error);
            return;
        }

        excuseBox.innerText = `"${data.excuse}"`;
        excuseBox.style.display = 'block';

        history.innerHTML = '';
        data.history.reverse().forEach(oldExcuse => {
            const li = document.createElement('li');
            li.innerText = oldExcuse;
            history.appendChild(li);
        });

    } catch (err) {
        console.error('Error fetching excuse:', err);
        alert('Failed to connect to the backend server. Try connecting again...');
    }
}