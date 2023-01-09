/**
 * Author: Oskar Pawica
 * This script is a browser extension for SessionLab. It calculates the time of delivery for each facilitator.
 *
 * Ideas for improvement?
 * Contact me personally or open a ticket in: https://github.com/pawicao/sessionlab-time-measurement
 */

/*
 * The extension initialization starts
 */

// global variables
let mainPanel;
let infoPanel;
let updateTimeout;
let buttonsEventListener;

// templates for generating nodes with time division
let main = generateMainTemplate();
let facilitatorTemplate = generateFacilitatorNodeTemplate();

// set a MutationObserver to initialize the extension only when all necessary nodes are rendered
const observer = new MutationObserver(() => {
  const newMainPanel = document.getElementById('main-panel'); // we'll be observing if this parent node exists
  if (newMainPanel && !mainPanel) {
    mainPanel = newMainPanel; // update the global variable
    mainPanel.addEventListener("click", handleButtonClick); // handle changes of facilitator assignments
    init(); // initialize the calculating process and observers
    return;
  }
  if (!newMainPanel && mainPanel && buttonsEventListener) {
    mainPanel.removeEventListener("click", handleButtonClick); // cleanup
  }
});

// start the process by running the observer
observer.observe(document.body, { childList: true, subtree: true });

// init is called when the DOM is fully rendered - it initializes the calculation process
function init() {
  observer.disconnect(); // cleanup the observer - we don't need it anymore
  const timeDivision = calculateTime(mainPanel); // get time per facilitator in an object
  assignTime(main, timeDivision); // generate the DOM elements in the main wrapper
  infoPanel = document.getElementById("vertical-tabs-tabpane-info").children[0];
  infoPanel.insertBefore(main, infoPanel.children[1]); // insert the main wrapper to its place on the website

  // set a MutationObserver to update the time table whenever someone changes the time at any block
  const mainCounterObserver = new MutationObserver(() => updateTime());

  // check the changes only in the element with id #react-header-left
  // - it's the main timer and it's enough to observe it
  mainCounterObserver.observe(
    document.getElementById('react-header-left'),
    {
      subtree: true,
      characterData: true,
      childList: true,
    }
  );
}


/*
 * Functions - DOM manipulation
 */

// handle any click inside the main panel for the event listener
function handleButtonClick(e) {
  const selector = ".user-edit a[role='button'], .user-edit a[role='button'] *";

  // Only update time if the click from the main panel was on the button responsible for assigning facilitators
  if (e.target.matches(selector)) {
    updateTime();
  }
}

// get a facilitator template, update it with proper values and return to be put into the list
function generateFacilitatorNode(name, time, image) {
  if (!facilitatorTemplate) {
    return null;
  }
  const formattedTime = getFormattedTime(time); // get time formatted as Xh Xmin

  const newFacilitatorNode = facilitatorTemplate.cloneNode(true);

  // set the facilitator image
  const childNodes = newFacilitatorNode.childNodes;
  const userImageNode = childNodes[0].firstChild;
  userImageNode.setAttribute("alt", name);
  userImageNode.setAttribute("src", image);

  // time
  const timeWrapper = childNodes[1];
  const nameElement = timeWrapper.childNodes[0];
  const timeElement = timeWrapper.childNodes[1];

  nameElement.innerText = `${name}: `;
  timeElement.innerText = formattedTime;

  return newFacilitatorNode;
}

// assign the time by generating a facilitator row for each facilitator inside the HTML wrapper
function assignTime(mainNode, timeDivision) {
  const groupNode = mainNode.querySelector('#time-division-users');
  if (!groupNode) {
    return;
  }

  const generatedTimeNodes = Object.entries(timeDivision)
    .map(([name, {time, image}]) => generateFacilitatorNode(name, time, image));

  groupNode.replaceChildren(...generatedTimeNodes);
}

// generate the HTML where the time results will be put
function generateMainTemplate() {
  // main
  const main = document.createElement('div');
  main.classList.add("box", "box-small", "box-lighter", "box-border-bottom");

  // title
  const title = document.createElement('h3');
  title.classList.add("small", "no-margin-top");

  // refresh button
  const refreshButtonWrapper = document.createElement('div');
  refreshButtonWrapper.classList.add("float-end");
  const refreshButton = document.createElement('a');
  refreshButton.classList.add("btn-icon");
  refreshButton.setAttribute("href", "#");
  const refreshButtonIcon = document.createElement('i');
  refreshButtonIcon.classList.add('fa-sm', 'fa-solid', 'fa-history');
  refreshButtonIcon.setAttribute("aria-hidden", "true");
  refreshButton.onclick = function() {
    updateTime(0);
  }
  refreshButton.appendChild(refreshButtonIcon);
  refreshButtonWrapper.appendChild(refreshButton);

  title.append("Time division", refreshButtonWrapper);

  // group of users
  const group = document.createElement('div');
  group.setAttribute("id", "time-division-users");

  // append children to the main elements
  main.appendChild(title);
  main.appendChild(group);

  return main;
}

// generate a template for the facilitator row
function generateFacilitatorNodeTemplate() {
  // main wrapper
  const wrapper = document.createElement("div");
  wrapper.classList.add("category-row", "d-flex");
  wrapper.style.marginBottom = '8px';

  // user avatar wrapper
  const userWrapper = document.createElement("span");
  userWrapper.classList.add("user", "user-inline");
  userWrapper.style.marginRight = "0.5rem";

  // image node
  const userImageNode = document.createElement('img');
  userImageNode.setAttribute("height", '18');
  userImageNode.classList.add('gravatar');

  // time
  const timeWrapper = document.createElement("span");
  const nameElement = document.createElement('b');
  const timeElement = document.createElement('small');

  // add all children
  timeWrapper.append(nameElement, timeElement);
  userWrapper.appendChild(userImageNode);
  wrapper.append(userWrapper, timeWrapper);

  return wrapper;
}


/*
 * Functions - time calculations
 */

// re-calculate the time
function updateTime(timeout = 500) {
  if (updateTimeout) {
    // clear the timeout if user clicks again quickly
    clearTimeout(updateTimeout);
  }

  // update the time with a delay - so that we don't spam with actions when user quickly change many things
  updateTimeout = setTimeout(() => {
    if (!infoPanel) {
      infoPanel = document.getElementById("vertical-tabs-tabpane-info").children[0];
    }
    const timeDivision = calculateTime(mainPanel);
    assignTime(main, timeDivision);
    infoPanel.insertBefore(main, infoPanel.children[1]);
  }, timeout);
}

// format the time from just minutes to Xh Xmin
function getFormattedTime(inputMinutes) {
  const hours = Math.floor(inputMinutes / 60);
  const minutes = inputMinutes % 60;

  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

// Convert the input from hours and minutes to just minutes
function calculateMinutes(node) {
  const timeNodes = node.getElementsByTagName("b");
  if (!timeNodes.length) {
    return 0;
  }

  let minutes = parseInt(timeNodes[timeNodes.length-1].innerText, 10);
  // handle hours
  if (timeNodes.length > 1) {
    minutes += parseInt(timeNodes[0].innerText, 10) * 60;
  }

  return minutes;
}

// get the time for each facilitator
function calculateTime(mainPanel) {
  const timeDivision = {
    /*
    "Name Surname": {image, time}
     */
  };

  // find all the DOM elements containing users with their time in session blocks
  const blockMatches = mainPanel.querySelectorAll(".block-users");

  // for each found block get users
  for (const userBlock of blockMatches) {
    const lengthBlock = userBlock.previousElementSibling.querySelector(".FuzzyDurationTimeInput span");
    if (!lengthBlock) {
      continue; // skip if there is no information about time for some reason
    }

    // calculate the time in minutes
    const time = calculateMinutes(lengthBlock);

    // find users for each block and add time to their objects
    for (const user of userBlock.children) {
      if (!user.children.length || !user.classList.contains('user-inline')) {
        continue; // skip unimportant nodes
      }
      const userImgElement = user.children[0];

      // extract user information from the img node
      const name = userImgElement.getAttribute('alt');
      const image = userImgElement.getAttribute('src');

      // create or update user object globally
      if (timeDivision[name]) {
        timeDivision[name].time += time;
      } else {
        timeDivision[name] = {
          time,
          image,
        }
      }
    }
  }

  return timeDivision;
}
