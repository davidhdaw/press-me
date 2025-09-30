/**
 * Wraps each letter in an element's text content with a span element
 * for individual letter animation and styling
 * @param {HTMLElement} element - The element whose text content to wrap
 */
function addBounce(element) {
  // Get the text content of the element
  const text = element.textContent;
  
  // Clear the element's content
  element.innerHTML = '';
  
  // Split the text into individual characters
  const letters = text.split('');
  
  // Create a span for each letter and append it to the element
  letters.forEach((letter, index) => {
    const span = document.createElement('span');
    span.textContent = letter === ' ' ? '\u00A0' : letter; // Replace spaces with non-breaking spaces
    span.style.display = 'inline-block'; // Allows for individual transforms
    span.setAttribute('data-index', index);
    span.style.setProperty('--i', index); // CSS custom property for animation delays
    element.appendChild(span);
  });
}

// Export the function for use in other files
export { addBounce };
