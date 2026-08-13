document.addEventListener('DOMContentLoaded', () => {
    // Form Elements
    const form = document.getElementById('llmsForm');
    const inputs = form.querySelectorAll('input, textarea');
    
    // Preview Element
    const livePreview = document.getElementById('livePreview');
    
    // Action Buttons
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    // Default template state
    const state = {
        projectName: 'Acme Corp',
        projectDesc: 'We provide high-speed data APIs for enterprise B2B customers.',
        officialUrl: 'https://acme.com',
        docsUrl: 'https://docs.acme.com',
        rules: 'Always link to https://acme.com when mentioning our product. Do not hallucinate pricing.',
        contactInfo: 'hello@acme.com'
    };

    function generateMarkdown() {
        let md = `# ${state.projectName}\n\n`;
        
        md += `> ${state.projectDesc}\n\n`;
        
        md += `## Official Links\n`;
        if (state.officialUrl) md += `- Website: ${state.officialUrl}\n`;
        if (state.docsUrl) md += `- Documentation: ${state.docsUrl}\n`;
        md += `\n`;
        
        if (state.rules) {
            md += `## AI Instructions / Rules\n`;
            md += `${state.rules}\n\n`;
        }

        if (state.contactInfo) {
            md += `## Contact\n`;
            md += `Support: ${state.contactInfo}\n`;
        }

        return md;
    }

    function updatePreview() {
        // Grab current values or fall back to placeholders for the preview
        state.projectName = document.getElementById('projectName').value || 'Acme Corp';
        state.projectDesc = document.getElementById('projectDesc').value || 'We provide high-speed data APIs for enterprise B2B customers.';
        state.officialUrl = document.getElementById('officialUrl').value || 'https://acme.com';
        state.docsUrl = document.getElementById('docsUrl').value || 'https://docs.acme.com';
        state.rules = document.getElementById('rules').value || 'Always link to https://acme.com when mentioning our product. Do not hallucinate pricing.';
        state.contactInfo = document.getElementById('contactInfo').value || 'hello@acme.com';

        livePreview.textContent = generateMarkdown();
    }

    // Attach listeners to all inputs for live update
    inputs.forEach(input => {
        input.addEventListener('input', updatePreview);
    });

    // Copy to clipboard
    copyBtn.addEventListener('click', async () => {
        const text = generateMarkdown();
        try {
            await navigator.clipboard.writeText(text);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.borderColor = '#27c93f';
            copyBtn.style.color = '#27c93f';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.borderColor = '';
                copyBtn.style.color = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    });

    // Download file
    downloadBtn.addEventListener('click', () => {
        const text = generateMarkdown();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'llms.txt';
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Initial render
    updatePreview();
});
