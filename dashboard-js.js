// dashboard.js - Enhanced Client-side JavaScript for Production Scheduling Dashboard
// Compatible with product-specific late parts and rework tasks
let mechanicOptionsCache = {};
let lastFilterKey = null;
let currentScenario = 'baseline';
let currentView = 'team-lead';
let selectedTeam = 'all';
let selectedSkill = 'all';
let selectedShift = 'all';
let selectedProduct = 'all';
let scenarioData = {};
let allScenarios = {};
let mechanicAvailability = {};
let taskAssignments = {};
let savedAssignments = {}; // Store assignments per scenario
let latePartsData = {};
let supplyChainMetrics = {};


// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Production Scheduling Dashboard...');
    loadAllScenarios();
    setupEventListeners();
    setupProductFilter();
    setupRefreshButton();
});

// Load all scenarios at startup for quick switching
// Load all scenarios at startup for quick switching
async function loadAllScenarios() {
    try {
        showLoading('Loading scenario data...');
        const scenariosResponse = await fetch('/api/scenarios');
        const scenariosInfo = await scenariosResponse.json();

        console.log('Loading scenarios:', scenariosInfo.scenarios.map(s => s.id));

        // Load each scenario
        for (const scenario of scenariosInfo.scenarios) {
            const response = await fetch(`/api/scenario/${scenario.id}`);
            if (response.ok) {
                const data = await response.json();
                allScenarios[scenario.id] = data;
                console.log(`✓ Loaded ${scenario.id}: ${data.tasks ? data.tasks.length : 0} tasks`);
            } else {
                console.error(`✗ Failed to load ${scenario.id}`);
            }
        }

        // Set the initial scenario data - MAKE SURE THIS IS CORRECT
        if (allScenarios[currentScenario] && allScenarios[currentScenario].tasks) {
            scenarioData = allScenarios[currentScenario];
            console.log('Set scenarioData to', currentScenario, 'with', scenarioData.tasks.length, 'tasks');
        } else if (allScenarios['baseline'] && allScenarios['baseline'].tasks) {
            currentScenario = 'baseline';
            scenarioData = allScenarios['baseline'];
            console.log('Fallback to baseline with', scenarioData.tasks.length, 'tasks');
        } else {
            console.error('No valid scenarios loaded!');
            console.log('allScenarios:', allScenarios);
        }

        hideLoading();

        // Verify the data structure
        console.log('Final scenarioData keys:', Object.keys(scenarioData));
        console.log('Has tasks?', !!scenarioData.tasks);
        console.log('Task count:', scenarioData.tasks?.length || 0);

        if (scenarioData && scenarioData.tasks && scenarioData.tasks.length > 0) {
            populateTeamDropdowns();  // ADD THIS LINE
            updateProductFilter();
            updateView();
        } else {
            console.error('ScenarioData is missing tasks!');
            showError('No task data available. Please check the server.');
        }
    } catch (error) {
        console.error('Error loading scenarios:', error);
        hideLoading();
        showError('Failed to load scenario data. Please refresh the page.');
    }
}

// Setup all event listeners
function setupEventListeners() {
    // View tab switching
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchView(this.dataset.view);
        });
    });

    // Scenario selection
    const scenarioSelect = document.getElementById('scenarioSelect');
    if (scenarioSelect) {
        scenarioSelect.addEventListener('change', function() {
            switchScenario(this.value);
        });
    }

    // Team selection - includes skill dropdown update
    const teamSelect = document.getElementById('teamSelect');
    if (teamSelect) {
        teamSelect.addEventListener('change', function() {
            selectedTeam = this.value;
            updateSkillDropdown();  // Update skills based on team selection
            updateShiftDropdown();  // Update shifts based on team selection
            updateTeamLeadView();
        });
    }

    // Skill selection (NEW)
    const skillSelect = document.getElementById('skillSelect');
    if (skillSelect) {
        skillSelect.addEventListener('change', function() {
            selectedSkill = this.value;
            updateTeamLeadView();
        });
    }

    // Shift selection
    const shiftSelect = document.getElementById('shiftSelect');
    if (shiftSelect) {
        shiftSelect.addEventListener('change', function() {
            selectedShift = this.value;
            updateTeamLeadView();
        });
    }

    // Product selection
    const productSelect = document.getElementById('productSelect');
    if (productSelect) {
        productSelect.addEventListener('change', function() {
            selectedProduct = this.value;
            updateTeamLeadView();
        });
    }

    // Mechanic selection for individual view
    const mechanicSelect = document.getElementById('mechanicSelect');
    if (mechanicSelect) {
        mechanicSelect.addEventListener('change', function() {
            updateMechanicView();
        });
    }

    // Auto-assign button
    const autoAssignBtn = document.querySelector('button[onclick="autoAssign()"]');
    if (autoAssignBtn && !autoAssignBtn.hasAttribute('data-listener-added')) {
        autoAssignBtn.setAttribute('data-listener-added', 'true');
        autoAssignBtn.removeAttribute('onclick');
        autoAssignBtn.addEventListener('click', function() {
            autoAssign();
        });
    }

    // Save button
    const saveBtn = document.querySelector('button[onclick="saveAssignmentsToStorage()"]');
    if (saveBtn && !saveBtn.hasAttribute('data-listener-added')) {
        saveBtn.setAttribute('data-listener-added', 'true');
        saveBtn.removeAttribute('onclick');
        saveBtn.addEventListener('click', function() {
            saveAssignmentsToStorage();
        });
    }

    // Load button
    const loadBtn = document.querySelector('button[onclick="loadAssignmentsFromStorage()"]');
    if (loadBtn && !loadBtn.hasAttribute('data-listener-added')) {
        loadBtn.setAttribute('data-listener-added', 'true');
        loadBtn.removeAttribute('onclick');
        loadBtn.addEventListener('click', function() {
            loadAssignmentsFromStorage();
        });
    }

    // Clear saved button
    const clearSavedBtn = document.querySelector('button[onclick="clearSavedAssignments()"]');
    if (clearSavedBtn && !clearSavedBtn.hasAttribute('data-listener-added')) {
        clearSavedBtn.setAttribute('data-listener-added', 'true');
        clearSavedBtn.removeAttribute('onclick');
        clearSavedBtn.addEventListener('click', function() {
            clearSavedAssignments();
        });
    }

    // Clear view button
    const clearViewBtn = document.querySelector('button[onclick="clearAllAssignments()"]');
    if (clearViewBtn && !clearViewBtn.hasAttribute('data-listener-added')) {
        clearViewBtn.setAttribute('data-listener-added', 'true');
        clearViewBtn.removeAttribute('onclick');
        clearViewBtn.addEventListener('click', function() {
            clearAllAssignments();
        });
    }

    // Export button
    const exportBtn = document.querySelector('button[onclick="exportTasks()"]');
    if (exportBtn && !exportBtn.hasAttribute('data-listener-added')) {
        exportBtn.setAttribute('data-listener-added', 'true');
        exportBtn.removeAttribute('onclick');
        exportBtn.addEventListener('click', function() {
            exportTasks();
        });
    }

    // Gantt view controls (if in project view)
    const ganttProductSelect = document.getElementById('ganttProductSelect');
    if (ganttProductSelect) {
        ganttProductSelect.addEventListener('change', function() {
            if (typeof renderGanttChart === 'function') {
                renderGanttChart();
            }
        });
    }

    const ganttTeamSelect = document.getElementById('ganttTeamSelect');
    if (ganttTeamSelect) {
        ganttTeamSelect.addEventListener('change', function() {
            if (typeof renderGanttChart === 'function') {
                renderGanttChart();
            }
        });
    }

    const ganttSortSelect = document.getElementById('ganttSortSelect');
    if (ganttSortSelect) {
        ganttSortSelect.addEventListener('change', function() {
            if (typeof handleGanttSortChange === 'function') {
                handleGanttSortChange();
            }
        });
    }

    // Task assignment selects (dynamic)
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('assign-select')) {
            const taskId = e.target.dataset.taskId;
            const position = e.target.dataset.position || '0';
            const mechanicId = e.target.value;

            // Initialize saved assignments for this scenario if needed
            if (!savedAssignments[currentScenario]) {
                savedAssignments[currentScenario] = {};
            }

            // Update or create assignment record
            if (!savedAssignments[currentScenario][taskId]) {
                const task = scenarioData.tasks.find(t => t.taskId === taskId);
                if (task) {
                    savedAssignments[currentScenario][taskId] = {
                        mechanics: [],
                        team: task.team,
                        mechanicsNeeded: task.mechanics || 1
                    };
                }
            }

            // Update the specific position
            if (savedAssignments[currentScenario][taskId]) {
                const assignment = savedAssignments[currentScenario][taskId];
                if (!assignment.mechanics) assignment.mechanics = [];

                // Ensure array is large enough
                while (assignment.mechanics.length <= parseInt(position)) {
                    assignment.mechanics.push('');
                }

                // Set the mechanic at this position
                assignment.mechanics[parseInt(position)] = mechanicId;

                // Mark as partial if not all positions filled
                const filledCount = assignment.mechanics.filter(m => m).length;
                assignment.partial = filledCount < assignment.mechanicsNeeded;
            }

            // Visual feedback
            if (mechanicId) {
                e.target.style.backgroundColor = '#d4edda';
                setTimeout(() => {
                    e.target.style.backgroundColor = '';
                    e.target.classList.add('has-saved-assignment');
                }, 1000);

                // Update mechanic schedules for Individual view
                updateMechanicSchedulesFromAssignments();
            } else {
                e.target.classList.remove('has-saved-assignment');
            }

            // Optional: Make API call to save on server
            if (mechanicId) {
                fetch('/api/assign_task', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        taskId: taskId,
                        mechanicId: mechanicId,
                        position: position,
                        scenario: currentScenario
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log(`Task ${taskId} position ${position} assigned to ${mechanicId}`);
                    }
                })
                .catch(error => {
                    console.error('Error saving assignment:', error);
                });
            }

            // Update assignment summary
            if (typeof updateAssignmentSummary === 'function') {
                updateAssignmentSummary();
            }
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + R to refresh data
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            refreshData();
        }

        // Ctrl/Cmd + E to export
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            exportTasks();
        }

        // Number keys 1-4 to switch views
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            switch(e.key) {
                case '1':
                    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                        switchView('team-lead');
                    }
                    break;
                case '2':
                    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                        switchView('management');
                    }
                    break;
                case '3':
                    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                        switchView('mechanic');
                    }
                    break;
                case '4':
                    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                        switchView('project');
                    }
                    break;
                    // Add Supply Chain to the view switching logic in setupEventListeners()
                case '5':
                    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                        switchView('supply-chain');
                    }
                    break;
            }
        }
    });

    // Window resize handler for responsive adjustments
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            // Refresh Gantt chart if visible
            if (currentView === 'project' && typeof renderGanttChart === 'function') {
                renderGanttChart();
            }
        }, 250);
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', function(e) {
        if (e.state && e.state.view) {
            switchView(e.state.view);
        }
        if (e.state && e.state.scenario) {
            switchScenario(e.state.scenario);
        }
    });
}

// Handle Gantt sort functionality
function handleGanttSortChange() {
    const sortBy = document.getElementById('ganttSortSelect').value;
    const productFilter = document.getElementById('ganttProductSelect').value || 'all';
    const teamFilter = document.getElementById('ganttTeamSelect').value || 'all';

    let tasks = getGanttTasks(productFilter, teamFilter);

    // Sort tasks based on selection
    switch(sortBy) {
        case 'start':
            tasks.sort((a, b) => new Date(a.start) - new Date(b.start));
            break;
        case 'product':
            tasks.sort((a, b) => {
                if (a.product !== b.product) {
                    return a.product.localeCompare(b.product);
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        case 'priority':
            tasks.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        case 'team':
            tasks.sort((a, b) => {
                if (a.team !== b.team) {
                    return a.team.localeCompare(b.team);
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        case 'duration':
            tasks.sort((a, b) => {
                if (a.duration !== b.duration) {
                    return b.duration - a.duration; // Longest first
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        default:
            tasks.sort((a, b) => new Date(a.start) - new Date(b.start));
    }

    renderGanttChartWithTasks(tasks);
}


// Setup product filter (new feature)
function setupProductFilter() {
    const teamFilters = document.querySelector('.team-filters');
    if (teamFilters && !document.getElementById('productSelect')) {
        const productFilter = document.createElement('div');
        productFilter.className = 'filter-group';
        productFilter.innerHTML = `
            <label>Product:</label>
            <select id="productSelect">
                <option value="all">All Products</option>
            </select>
        `;
        teamFilters.appendChild(productFilter);

        document.getElementById('productSelect').addEventListener('change', function() {
            selectedProduct = this.value;
            updateTeamLeadView();
        });
    }
}

// Switch scenario with enhanced handling
function switchScenario(scenario) {
    if (allScenarios[scenario]) {
        currentScenario = scenario;
        scenarioData = allScenarios[scenario];

        console.log(`Switched to ${scenario}, teamCapacities:`, scenarioData.teamCapacities);

        // CRITICAL: Re-populate team dropdowns with new scenario's capacities
        populateTeamDropdowns();

        updateProductFilter();
        showScenarioInfo();
        updateView();

        // Load saved assignments for this scenario if they exist
        if (currentView === 'team-lead') {
            loadSavedAssignments();
        }
    }
}

// Update product filter dropdown
function updateProductFilter() {
    const productSelect = document.getElementById('productSelect');
    if (productSelect && scenarioData.products) {
        const currentSelection = productSelect.value;
        productSelect.innerHTML = '<option value="all">All Products</option>';
        scenarioData.products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.name;
            option.textContent = `${product.name} (${product.totalTasks} tasks)`;
            productSelect.appendChild(option);
        });
        if ([...productSelect.options].some(opt => opt.value === currentSelection)) {
            productSelect.value = currentSelection;
        } else {
            productSelect.value = 'all';
            selectedProduct = 'all';
        }
    }
}

// Show scenario-specific information
function showScenarioInfo() {
    let infoBanner = document.getElementById('scenarioInfo');
    if (!infoBanner) {
        const mainContent = document.querySelector('.main-content');
        infoBanner = document.createElement('div');
        infoBanner.id = 'scenarioInfo';
        infoBanner.style.cssText = 'background: #f0f9ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px; margin-bottom: 20px;';
        mainContent.insertBefore(infoBanner, mainContent.firstChild);
    }

    let infoHTML = `<strong>${currentScenario.toUpperCase()}</strong>: `;
    if (currentScenario === 'scenario3' && scenarioData.achievedMaxLateness !== undefined) {
        if (scenarioData.achievedMaxLateness === 0) {
            infoHTML += `✓ Achieved zero lateness with ${scenarioData.totalWorkforce} workers`;
        } else {
            infoHTML += `Minimum achievable lateness: ${scenarioData.achievedMaxLateness} days (${scenarioData.totalWorkforce} workers)`;
        }
    } else if (currentScenario === 'scenario2') {
        infoHTML += `Optimal uniform capacity: ${scenarioData.optimalMechanics || 'N/A'} mechanics, ${scenarioData.optimalQuality || 'N/A'} quality per team`;
    } else {
        infoHTML += `Workforce: ${scenarioData.totalWorkforce}, Makespan: ${scenarioData.makespan} days`;
    }
    infoBanner.innerHTML = infoHTML;
}

// Switch between views
function switchView(view) {
    document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    document.getElementById(`${view}-view`).classList.add('active');
    currentView = view;
    updateView();

}

// Update view based on current selection
function updateView() {
    if (!scenarioData) return;
    if (currentView === 'team-lead') {
        updateTeamLeadView();
    } else if (currentView === 'management') {
        updateManagementView();
    } else if (currentView === 'mechanic') {
        updateMechanicView();
    } else if (currentView === 'project') {
        // Initialize timeline instead of Gantt chart
        initializeCustomGantt();
    } else if (currentView === 'supply-chain') {
        updateSupplyChainView();
    }
}


function populateTeamDropdowns() {
    console.log(`Populating team dropdowns for scenario: ${currentScenario}`);

    if (!scenarioData || !scenarioData.teamCapacities) {
        console.warn('No team capacity data available in current scenario');
        return;
    }

    const teamCapacities = scenarioData.teamCapacities;

    // Extract base teams and aggregate capacities
    const baseTeams = new Map();
    const teamSkills = new Map();

    Object.entries(teamCapacities).forEach(([teamSkill, capacity]) => {
        let baseTeam, skill;

        const skillMatch = teamSkill.match(/^(.+?)\s*\((.+?)\)\s*$/);
        if (skillMatch) {
            baseTeam = skillMatch[1].trim();
            skill = skillMatch[2].trim();
        } else {
            baseTeam = teamSkill;
            skill = null;
        }

        if (!baseTeams.has(baseTeam)) {
            baseTeams.set(baseTeam, 0);
            teamSkills.set(baseTeam, new Set());
        }
        baseTeams.set(baseTeam, baseTeams.get(baseTeam) + capacity);

        if (skill) {
            teamSkills.get(baseTeam).add(skill);
        }
    });

    // Separate mechanic, quality, and customer teams
    const mechanicTeams = [];
    const qualityTeams = [];
    const customerTeams = [];

    baseTeams.forEach((capacity, team) => {
        if (team.toLowerCase().includes('customer')) {
            customerTeams.push({ name: team, capacity: capacity });
        } else if (team.toLowerCase().includes('quality')) {
            qualityTeams.push({ name: team, capacity: capacity });
        } else if (team.toLowerCase().includes('mechanic')) {
            mechanicTeams.push({ name: team, capacity: capacity });
        }
    });

    // Sort teams by name
    mechanicTeams.sort((a, b) => a.name.localeCompare(b.name));
    qualityTeams.sort((a, b) => a.name.localeCompare(b.name));
    customerTeams.sort((a, b) => a.name.localeCompare(b.name));

    // Update team dropdown
    const teamSelect = document.getElementById('teamSelect');
    if (teamSelect) {
        const currentSelection = teamSelect.value;

        teamSelect.innerHTML = `
            <option value="all">All Teams</option>
            <option value="all-mechanics">All Mechanic Teams</option>
            <option value="all-quality">All Quality Teams</option>
            <option value="all-customer">All Customer Teams</option>
        `;

        // Add Mechanic Teams
        if (mechanicTeams.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Mechanic Teams';
            mechanicTeams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.name;
                option.textContent = `${team.name} (${team.capacity} total capacity)`;
                optgroup.appendChild(option);
            });
            teamSelect.appendChild(optgroup);
        }

        // Add Quality Teams
        if (qualityTeams.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Quality Teams';
            qualityTeams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.name;
                option.textContent = `${team.name} (${team.capacity} total capacity)`;
                optgroup.appendChild(option);
            });
            teamSelect.appendChild(optgroup);
        }

        // Add Customer Teams
        if (customerTeams.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Customer Teams';
            customerTeams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.name;
                option.textContent = `${team.name} (${team.capacity} total capacity)`;
                optgroup.appendChild(option);
            });
            teamSelect.appendChild(optgroup);
        }

        // Restore selection if still valid
        if (Array.from(teamSelect.options).some(opt => opt.value === currentSelection)) {
            teamSelect.value = currentSelection;
        } else {
            teamSelect.value = 'all';
            selectedTeam = 'all';
        }
    }

    window.teamSkillsMap = teamSkills;
    updateSkillDropdown();
    updateShiftDropdown();
}

function updateSkillDropdown() {
    const skillSelect = document.getElementById('skillSelect');
    if (!skillSelect) return;

    const currentSkillSelection = skillSelect.value;
    skillSelect.innerHTML = '<option value="all">All Skills</option>';

    // Get available skills based on selected team
    const availableSkills = new Set();

    if (selectedTeam === 'all' || selectedTeam === 'all-mechanics' || selectedTeam === 'all-quality') {
        // Show all skills from all relevant teams
        const teamFilter = selectedTeam === 'all-mechanics' ? 'Mechanic' :
                         selectedTeam === 'all-quality' ? 'Quality' : '';

        Object.keys(scenarioData.teamCapacities || {}).forEach(teamSkill => {
            if (teamFilter && !teamSkill.includes(teamFilter)) return;

            const skillMatch = teamSkill.match(/\((.+?)\)/);
            if (skillMatch) {
                availableSkills.add(skillMatch[1]);
            }
        });
    } else if (selectedTeam && window.teamSkillsMap) {
        // Show skills for specific team
        const skills = window.teamSkillsMap.get(selectedTeam);
        if (skills) {
            skills.forEach(skill => availableSkills.add(skill));
        }
    }

    // Add skill options
    const sortedSkills = Array.from(availableSkills).sort();
    sortedSkills.forEach(skill => {
        const option = document.createElement('option');
        option.value = skill;
        option.textContent = skill;
        skillSelect.appendChild(option);
    });

    // Restore selection if still valid
    if (Array.from(skillSelect.options).some(opt => opt.value === currentSkillSelection)) {
        skillSelect.value = currentSkillSelection;
    } else {
        skillSelect.value = 'all';
        selectedSkill = 'all';
    }
}

function updateShiftDropdown() {
    const shiftSelect = document.getElementById('shiftSelect');
    if (!shiftSelect || !scenarioData) return;

    // Store current selection
    const currentShiftSelection = shiftSelect.value;

    // Get available shifts based on selected team(s)
    let availableShifts = new Set();

    if (!scenarioData.teamShifts) {
        console.warn('No team shift data available');
        // Default to all shifts if no data
        availableShifts.add('1st');
        availableShifts.add('2nd');
        availableShifts.add('3rd');
    } else {
        if (selectedTeam === 'all') {
            // All teams - get all shifts from all teams
            Object.values(scenarioData.teamShifts).forEach(shifts => {
                if (Array.isArray(shifts)) {
                    shifts.forEach(shift => availableShifts.add(shift));
                }
            });
        } else if (selectedTeam === 'all-mechanics') {
            // All mechanic teams - get shifts from mechanic teams only
            Object.entries(scenarioData.teamShifts).forEach(([team, shifts]) => {
                if (team.toLowerCase().includes('mechanic') || team.toLowerCase().includes('mech')) {
                    if (Array.isArray(shifts)) {
                        shifts.forEach(shift => availableShifts.add(shift));
                    }
                }
            });
        } else if (selectedTeam === 'all-quality') {
            // All quality teams - get shifts from quality teams only
            Object.entries(scenarioData.teamShifts).forEach(([team, shifts]) => {
                if (team.toLowerCase().includes('quality') || team.toLowerCase().includes('qual')) {
                    if (Array.isArray(shifts)) {
                        shifts.forEach(shift => availableShifts.add(shift));
                    }
                }
            });
        } else {
            // Specific team selected - get only that team's shifts
            const teamShifts = scenarioData.teamShifts[selectedTeam];
            if (Array.isArray(teamShifts)) {
                teamShifts.forEach(shift => availableShifts.add(shift));
            } else {
                // Fallback to all shifts if team not found
                console.warn(`No shift data for team: ${selectedTeam}`);
                availableShifts.add('1st');
                availableShifts.add('2nd');
                availableShifts.add('3rd');
            }
        }
    }

    // If no shifts found, default to all
    if (availableShifts.size === 0) {
        availableShifts.add('1st');
        availableShifts.add('2nd');
        availableShifts.add('3rd');
    }

    // Sort shifts in order (1st, 2nd, 3rd)
    const shiftOrder = ['1st', '2nd', '3rd'];
    const sortedShifts = Array.from(availableShifts).sort((a, b) => {
        return shiftOrder.indexOf(a) - shiftOrder.indexOf(b);
    });

    // Rebuild shift dropdown
    shiftSelect.innerHTML = '<option value="all">All Shifts</option>';

    sortedShifts.forEach(shift => {
        const option = document.createElement('option');
        option.value = shift;

        // Add shift times for clarity
        let shiftLabel = shift + ' Shift';
        if (shift === '1st') {
            shiftLabel += ' (6:00 AM - 2:30 PM)';
        } else if (shift === '2nd') {
            shiftLabel += ' (2:30 PM - 11:00 PM)';
        } else if (shift === '3rd') {
            shiftLabel += ' (11:00 PM - 6:00 AM)';
        }

        option.textContent = shiftLabel;
        shiftSelect.appendChild(option);
    });

    // Restore selection if still available
    const newOptions = Array.from(shiftSelect.options);
    if (newOptions.some(opt => opt.value === currentShiftSelection)) {
        shiftSelect.value = currentShiftSelection;
    } else {
        shiftSelect.value = 'all';
        selectedShift = 'all';
    }

    // Log what shifts are available
    console.log(`Updated shift dropdown for ${selectedTeam}:`, Array.from(availableShifts));
}

// Enhanced Team Lead View with separate team and skill filtering
async function updateTeamLeadView() {
    if (!scenarioData) return;

    // ========== SECTION 1: Calculate Team Capacity ==========
    let teamCap = 0;
    Object.entries(scenarioData.teamCapacities || {}).forEach(([teamSkill, capacity]) => {
        const skillMatch = teamSkill.match(/^(.+?)\s*\((.+?)\)\s*$/);
        let baseTeam = skillMatch ? skillMatch[1].trim() : teamSkill;
        let skill = skillMatch ? skillMatch[2].trim() : null;

        let teamMatches = false;
        if (selectedTeam === 'all') {
            teamMatches = true;
        } else if (selectedTeam === 'all-mechanics') {
            teamMatches = baseTeam.toLowerCase().includes('mechanic');
        } else if (selectedTeam === 'all-quality') {
            teamMatches = baseTeam.toLowerCase().includes('quality');
        } else if (selectedTeam === 'all-customer') {
            teamMatches = baseTeam.toLowerCase().includes('customer');
        } else {
            teamMatches = baseTeam === selectedTeam;
        }

        let skillMatches = selectedSkill === 'all' || skill === selectedSkill;
        if (teamMatches && skillMatches) {
            teamCap += capacity;
        }
    });
    document.getElementById('teamCapacity').textContent = teamCap;

    // ========== SECTION 2: Filter and Sort Tasks ==========
    let tasks = (scenarioData.tasks || []).filter(task => {
        const taskTeamSkill = task.teamSkill || task.team || '';
        let taskBaseTeam = task.team;
        let taskSkill = task.skill;

        // Identify customer tasks by multiple criteria
        const isCustomerTask = task.taskId.includes('CC_') ||  // Changed from startsWith to includes
                              task.type === 'Customer' ||       // Also check for just 'Customer'
                              task.type === 'Customer Inspection' ||
                              task.isCustomerTask === true ||
                              (taskBaseTeam && taskBaseTeam.toLowerCase().includes('customer'));

        if (taskTeamSkill.includes('(')) {
            const match = taskTeamSkill.match(/^(.+?)\s*\((.+?)\)\s*$/);
            if (match) {
                taskBaseTeam = match[1].trim();
                taskSkill = match[2].trim();
            }
        }

        let teamMatch = false;
        if (selectedTeam === 'all') {
            teamMatch = true;  // Include ALL tasks including customer tasks
        } else if (selectedTeam === 'all-mechanics') {
            teamMatch = !isCustomerTask && !task.isQualityTask && taskBaseTeam && taskBaseTeam.toLowerCase().includes('mechanic');
        } else if (selectedTeam === 'all-quality') {
            teamMatch = !isCustomerTask && taskBaseTeam && taskBaseTeam.toLowerCase().includes('quality');
        } else if (selectedTeam === 'all-customer') {
            teamMatch = isCustomerTask;
        } else {
            // Specific team selected
            if (selectedTeam.toLowerCase().includes('customer')) {
                teamMatch = isCustomerTask;
            } else {
                teamMatch = taskBaseTeam === selectedTeam;
            }
        }

        let skillMatch = selectedSkill === 'all' || taskSkill === selectedSkill;
        const shiftMatch = selectedShift === 'all' || task.shift === selectedShift;
        const productMatch = selectedProduct === 'all' || task.product === selectedProduct;

        return teamMatch && skillMatch && shiftMatch && productMatch;
    });

    // ========== SECTION 3: Calculate Stats ==========
    const totalTasks = tasks.length;
    const displayTasks = tasks.slice(0, 1000); // LIMIT TO 1000

    // Today's tasks
    const today = new Date();
    const todayTasks = displayTasks.filter(t => {
        const taskDate = new Date(t.startTime);
        return taskDate.toDateString() === today.toDateString();
    });
    document.getElementById('tasksToday').textContent = todayTasks.length;

    // Critical tasks
    const critical = displayTasks.filter(t =>
        t.priority <= 10 || t.isLatePartTask || t.isReworkTask ||
        t.isCritical || (t.slackHours !== undefined && t.slackHours < 24)
    ).length;
    document.getElementById('criticalTasks').textContent = critical;

    // Utilization
    let totalUtilization = 0;
    let teamCount = 0;
    Object.entries(scenarioData.teamCapacities || {}).forEach(([teamSkill, capacity]) => {
        const skillMatch = teamSkill.match(/^(.+?)\s*\((.+?)\)\s*$/);
        let baseTeam = skillMatch ? skillMatch[1].trim() : teamSkill;
        let skill = skillMatch ? skillMatch[2].trim() : null;

        let matches = false;
        if (selectedTeam === 'all' ||
            (selectedTeam === 'all-mechanics' && baseTeam.toLowerCase().includes('mechanic')) ||
            (selectedTeam === 'all-quality' && baseTeam.toLowerCase().includes('quality')) ||
            (selectedTeam === 'all-customer' && baseTeam.toLowerCase().includes('customer')) ||
            selectedTeam === baseTeam) {
            if (selectedSkill === 'all' || skill === selectedSkill) {
                matches = true;
            }
        }

        if (matches && scenarioData.utilization && scenarioData.utilization[teamSkill]) {
            totalUtilization += scenarioData.utilization[teamSkill];
            teamCount++;
        }
    });
    const avgUtil = teamCount > 0 ? Math.round(totalUtilization / teamCount) : 0;
    document.getElementById('teamUtilization').textContent = avgUtil + '%';

    // ========== SECTION 4: Show Warning if Truncated ==========
    if (totalTasks > 1000) {
        let warningDiv = document.getElementById('taskLimitWarning');
        if (!warningDiv) {
            warningDiv = document.createElement('div');
            warningDiv.id = 'taskLimitWarning';
            warningDiv.className = 'task-limit-warning';
            warningDiv.style.cssText = 'background: #FEF3C7; border: 1px solid #F59E0B; padding: 12px; margin-bottom: 15px; border-radius: 6px;';
            const tableContainer = document.querySelector('.task-table-container');
            if (tableContainer) {
                tableContainer.parentNode.insertBefore(warningDiv, tableContainer);
            }
        }
        warningDiv.innerHTML = `⚠️ Showing top 1,000 of ${totalTasks.toLocaleString()} tasks (highest priority first)`;
    } else {
        const warningDiv = document.getElementById('taskLimitWarning');
        if (warningDiv) warningDiv.remove();
    }

    // ========== SECTION 5: Generate Mechanic Options ONCE ==========
    const filterKey = `${currentScenario}_${selectedTeam}_${selectedSkill}`;
    let mechanicOptions = '';

    if (mechanicOptionsCache[filterKey]) {
        mechanicOptions = mechanicOptionsCache[filterKey];
    } else {
        let optionsHtml = '<option value="">Unassigned</option>';

        Object.entries(scenarioData.teamCapacities || {}).forEach(([teamSkill, capacity]) => {
            const skillMatch = teamSkill.match(/^(.+?)\s*\((.+?)\)\s*$/);
            let baseTeam = skillMatch ? skillMatch[1].trim() : teamSkill;
            let skill = skillMatch ? skillMatch[2].trim() : null;

            let includeThis = false;
            if (selectedTeam === 'all') {
                includeThis = true;
            } else if (selectedTeam === 'all-mechanics' && baseTeam.toLowerCase().includes('mechanic')) {
                includeThis = true;
            } else if (selectedTeam === 'all-quality' && baseTeam.toLowerCase().includes('quality')) {
                includeThis = true;
            } else if (selectedTeam === 'all-customer' && baseTeam.toLowerCase().includes('customer')) {
                includeThis = true;
            } else if (selectedTeam === baseTeam) {
                includeThis = true;
            }

            if (includeThis && selectedSkill !== 'all' && skill !== selectedSkill) {
                includeThis = false;
            }

            if (includeThis && capacity > 0) {
                const isQuality = baseTeam.toLowerCase().includes('quality');
                const isCustomer = baseTeam.toLowerCase().includes('customer');

                let roleLabel = 'Mechanic';
                if (isCustomer) {
                    roleLabel = 'Customer Inspector';
                } else if (isQuality) {
                    roleLabel = 'Inspector';
                }

                for (let i = 1; i <= capacity; i++) {
                    const mechId = `${teamSkill}_${i}`;
                    const label = `${roleLabel} #${i} - ${baseTeam}${skill ? ` (${skill})` : ''}`;
                    optionsHtml += `<option value="${mechId}">${label}</option>`;
                }
            }
        });

        mechanicOptions = optionsHtml;
        mechanicOptionsCache[filterKey] = mechanicOptions;
    }

    // ========== SECTION 6: Build Table HTML Efficiently ==========
    const tbody = document.getElementById('taskTableBody');
    const rows = [];

    displayTasks.forEach(task => {
        const startTime = new Date(task.startTime);
        const mechanicsNeeded = task.mechanics || 1;

        // Check if this is a customer task
        const isCustomerTask = task.taskId.includes('CC_') ||
                              task.type === 'Customer' ||
                              task.type === 'Customer Inspection' ||
                              task.isCustomerTask === true;

        let typeIndicator = '';
        if (isCustomerTask) typeIndicator = ' 👤';
        else if (task.isLatePartTask) typeIndicator = ' 📦';
        else if (task.isReworkTask) typeIndicator = ' 🔧';
        else if (task.isCritical) typeIndicator = ' ⚡';
        let dependencyInfo = '';

        if (task.dependencies && task.dependencies.length > 0) {
            const deps = task.dependencies.slice(0, 3).map(d =>
                typeof d === 'object' ? (d.taskId || d.id || d.task) : d
            ).join(', ');
            const more = task.dependencies.length > 3 ? ` +${task.dependencies.length - 3} more` : '';
            dependencyInfo = `<span style="color: #6b7280; font-size: 11px;">Deps: ${deps}${more}</span>`;
        }

        let assignmentCells = '';
        if (mechanicsNeeded === 1) {
            assignmentCells = `
                <select class="assign-select" data-task-id="${task.taskId}" data-position="0">
                    ${mechanicOptions}
                </select>`;
        } else {
            assignmentCells = `<div style="display: flex; flex-direction: column; gap: 5px;">`;
            for (let i = 0; i < mechanicsNeeded; i++) {
                assignmentCells += `
                    <select class="assign-select" data-task-id="${task.taskId}" data-position="${i}" style="width: 100%; font-size: 12px;">
                        <option value="">Worker ${i + 1}</option>
                        ${mechanicOptions}
                    </select>`;
            }
            assignmentCells += `</div>`;
        }

        let rowStyle = '';
        if (isCustomerTask) rowStyle = 'background-color: #f3e8ff;';  // Light purple for customer
        else if (task.isLatePartTask) rowStyle = 'background-color: #fef3c7;';
        else if (task.isReworkTask) rowStyle = 'background-color: #fee2e2;';
        else if (task.isCritical) rowStyle = 'background-color: #dbeafe;';

        // Determine task type for display
        let taskType = task.type;
        if (isCustomerTask && !taskType.includes('Customer')) {
            taskType = 'Customer';
        }

        rows.push(`
            <tr style="${rowStyle}">
                <td class="priority">${task.priority || '-'}</td>
                <td class="task-id">${task.taskId}${typeIndicator}</td>
                <td><span class="task-type ${getTaskTypeClass(taskType)}">${taskType}</span></td>
                <td>${task.product}<br>${dependencyInfo}</td>
                <td>${formatDateTime(startTime)}</td>
                <td>${task.duration} min</td>
                <td style="text-align: center;">${mechanicsNeeded}</td>
                <td>${assignmentCells}</td>
            </tr>
        `);
    });

    // Single DOM update
    tbody.innerHTML = rows.join('');

    // ========== SECTION 7: Update Summary Stats ==========
    updateTaskTypeSummary(displayTasks);
    updateSelectionStatus();

    // ========== SECTION 8: Load Saved Assignments ==========
    if (savedAssignments[currentScenario]) {
        setTimeout(() => loadSavedAssignments(), 10);
    }
}

// Helper function for task type summary with customer support
function updateTaskTypeSummary(tasks) {
    const taskTypeCounts = {};
    let latePartCount = 0;
    let reworkCount = 0;
    let customerCount = 0;

    tasks.forEach(task => {
        // Ensure we're getting the type as a string
        const taskType = task.type || 'Unknown';
        taskTypeCounts[taskType] = (taskTypeCounts[taskType] || 0) + 1;

        if (task.isLatePartTask) latePartCount++;
        if (task.isReworkTask) reworkCount++;
        if (task.isCustomerTask) customerCount++;
    });

    let summaryDiv = document.getElementById('taskTypeSummary');
    if (!summaryDiv) {
        const statsContainer = document.querySelector('.team-stats');
        if (statsContainer) {
            summaryDiv = document.createElement('div');
            summaryDiv.id = 'taskTypeSummary';
            summaryDiv.className = 'stat-card';
            summaryDiv.style.gridColumn = 'span 2';
            statsContainer.appendChild(summaryDiv);
        }
    }

    if (summaryDiv) {
        let summaryHTML = '<h3>Task Type Breakdown</h3><div style="display: flex; gap: 15px; margin-top: 10px; flex-wrap: wrap;">';

        // Make sure we're iterating over the counts correctly
        Object.entries(taskTypeCounts).forEach(([type, count]) => {
            // Ensure type is a string
            const typeStr = String(type);
            const countNum = Number(count) || 0;

            summaryHTML += `
                <div style="flex: 1; min-width: 100px;">
                    <div style="font-size: 18px; font-weight: bold; color: ${getTaskTypeColor(typeStr)};">${countNum}</div>
                    <div style="font-size: 11px; color: #6b7280;">${typeStr}</div>
                </div>`;
        });

        summaryHTML += '</div>';

        if (latePartCount > 0 || reworkCount > 0 || customerCount > 0) {
            summaryHTML += `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">`;
            if (latePartCount > 0) summaryHTML += `<span style="margin-right: 15px;">📦 Late Parts: ${latePartCount}</span>`;
            if (reworkCount > 0) summaryHTML += `<span style="margin-right: 15px;">🔧 Rework: ${reworkCount}</span>`;
            if (customerCount > 0) summaryHTML += `<span>👤 Customer: ${customerCount}</span>`;
            summaryHTML += '</div>';
        }

        summaryDiv.innerHTML = summaryHTML;
    }
}

// Helper function to generate mechanic options based on current filters
function generateMechanicOptionsForFilters() {
    let options = '';

    // Get filtered team capacities based on current team and skill selection
    Object.entries(scenarioData.teamCapacities || {}).forEach(([teamSkill, capacity]) => {
        // Parse team and skill
        const skillMatch = teamSkill.match(/^(.+?)\s*\((.+?)\)\s*$/);
        let baseTeam, skill;

        if (skillMatch) {
            baseTeam = skillMatch[1].trim();
            skill = skillMatch[2].trim();
        } else {
            baseTeam = teamSkill;
            skill = null;
        }

        // Check if this team/skill matches current filters
        let includeThis = false;

        // Team filter
        if (selectedTeam === 'all') {
            includeThis = true;
        } else if (selectedTeam === 'all-mechanics' && baseTeam.toLowerCase().includes('mechanic')) {
            includeThis = true;
        } else if (selectedTeam === 'all-quality' && baseTeam.toLowerCase().includes('quality')) {
            includeThis = true;
        } else if (selectedTeam === baseTeam) {
            includeThis = true;
        }

        // Skill filter
        if (includeThis && selectedSkill !== 'all' && skill !== selectedSkill) {
            includeThis = false;
        }

        if (includeThis && capacity > 0) {
            const isQuality = baseTeam.toLowerCase().includes('quality');
            for (let i = 1; i <= capacity; i++) {
                const mechId = `${teamSkill}_${i}`;
                const label = `${isQuality ? 'Inspector' : 'Mechanic'} #${i} - ${baseTeam}${skill ? ` (${skill})` : ''}`;
                options += `<option value="${mechId}">${label}</option>`;
            }
        }
    });

    return options;
}

// Helper function to update selection status
function updateSelectionStatus() {
    let statusText = '';

    if (selectedTeam === 'all') {
        statusText = `Team: All teams`;
    } else if (selectedTeam === 'all-mechanics') {
        statusText = `Team: All mechanic teams`;
    } else if (selectedTeam === 'all-quality') {
        statusText = `Team: All quality teams`;
    } else {
        statusText = `Team: ${selectedTeam}`;
    }

    if (selectedSkill !== 'all') {
        statusText += ` | Skill: ${selectedSkill}`;
    }

    statusText += ` | Shift: ${selectedShift === 'all' ? 'All shifts' : selectedShift}`;
    statusText += ` | Product: ${selectedProduct === 'all' ? 'All products' : selectedProduct}`;

    // Create or update status div
    let statusDiv = document.getElementById('teamSelectionStatus');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'teamSelectionStatus';
        statusDiv.style.cssText = `
            background: #E0F2FE;
            border: 1px solid #0284C7;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 15px;
            font-size: 13px;
            color: #075985;
        `;
        const filtersDiv = document.querySelector('.team-filters');
        if (filtersDiv) {
            filtersDiv.parentNode.insertBefore(statusDiv, filtersDiv.nextSibling);
        }
    }

    statusDiv.innerHTML = `<strong>Active Filters:</strong> ${statusText}`;
}

// Removed unused helper functions - functionality is now integrated into autoAssign()

// Helper to check if task matches selected team
function taskMatchesTeamFilter(task, selectedTeam, teamsToInclude) {
    if (selectedTeam === 'all' || selectedTeam === 'all-mechanics' || selectedTeam === 'all-quality') {
        // For group selections, check base team
        const baseTeam = task.team || task.teamSkill;
        return teamsToInclude.some(team => baseTeam.includes(team));
    } else {
        // For specific team selection, match base team
        return task.team === selectedTeam;
    }
}

// Determine which teams to include based on selection
let teamsToInclude = [];

if (selectedTeam === 'all') {
    // For "all teams", include everything
    teamsToInclude = Object.keys(scenarioData.teamCapacities || {});
    // Also add base team names
    let baseTeams = new Set();
    for (let team of teamsToInclude) {
        let baseTeam = team.split(' (')[0]; // Extract base team name
        baseTeams.add(baseTeam);
    }
    // Add base teams to the list
    for (let baseTeam of baseTeams) {
        if (!teamsToInclude.includes(baseTeam)) {
            teamsToInclude.push(baseTeam);
        }
    }
} else if (selectedTeam === 'all-mechanics') {
    teamsToInclude = Object.keys(scenarioData.teamCapacities || {})
        .filter(t => (t.toLowerCase().includes('mechanic') || t.toLowerCase().includes('mech')) && !t.toLowerCase().includes('quality'));
    // Add base mechanic teams
    for (let i = 1; i <= 10; i++) {
        teamsToInclude.push(`Mechanic Team ${i}`);
    }
} else if (selectedTeam === 'all-quality') {
    teamsToInclude = Object.keys(scenarioData.teamCapacities || {})
        .filter(t => t.toLowerCase().includes('quality') || t.toLowerCase().includes('qual'));
    // Add base quality teams
    for (let i = 1; i <= 7; i++) {
        teamsToInclude.push(`Quality Team ${i}`);
    }
} else {
    teamsToInclude = [selectedTeam];
}

// Filter tasks - check both team and teamSkill fields
let tasks = (scenarioData.tasks || []).filter(task => {
    // Check if task's team matches any of the teams to include
    const taskTeam = task.team || '';
    const taskTeamSkill = task.teamSkill || task.team || '';

    const teamMatch = teamsToInclude.some(t => {
        // Check exact match first
        if (taskTeam === t || taskTeamSkill === t) return true;

        // Check if task team is a base team of an included team with skill
        if (t.includes('(') && taskTeam === t.split(' (')[0]) return true;

        // Check if included team is a base team of task's team
        if (taskTeamSkill.includes('(') && t === taskTeamSkill.split(' (')[0]) return true;

        return false;
    });

    const shiftMatch = selectedShift === 'all' || task.shift === selectedShift;
    const productMatch = selectedProduct === 'all' || task.product === selectedProduct;

    return teamMatch && shiftMatch && productMatch;
});


// Enhanced Management View with sorting, filtering and aggregation
function updateManagementView() {
    if (!scenarioData) return;
    document.getElementById('totalWorkforce').textContent = scenarioData.totalWorkforce;
    document.getElementById('makespan').textContent = scenarioData.makespan;
    document.getElementById('onTimeRate').textContent = scenarioData.onTimeRate + '%';
    document.getElementById('avgUtilization').textContent = scenarioData.avgUtilization + '%';

    let latenessCard = document.getElementById('latenessMetrics');
    if (!latenessCard) {
        const metricsGrid = document.querySelector('.metrics-grid');
        if (metricsGrid) {
            latenessCard = document.createElement('div');
            latenessCard.className = 'metric-card';
            latenessCard.id = 'latenessMetrics';
            metricsGrid.appendChild(latenessCard);
        }
    }

    if (latenessCard) {
        let latenessHTML = '<h3>Lateness Metrics</h3>';
        if (scenarioData.achievedMaxLateness !== undefined) {
            latenessHTML += `<div class="metric-value">${scenarioData.achievedMaxLateness}</div>`;
            latenessHTML += '<div class="metric-label">days max lateness (achieved)</div>';
        } else {
            latenessHTML += `<div class="metric-value">${scenarioData.maxLateness || 0}</div>`;
            latenessHTML += '<div class="metric-label">days maximum lateness</div>';
        }
        latenessCard.innerHTML = latenessHTML;
    }

const productGrid = document.getElementById('productGrid');
productGrid.innerHTML = '';
scenarioData.products.forEach(product => {
    const status = product.onTime ? 'on-time' :
        product.latenessDays <= 5 ? 'at-risk' : 'late';

    // Format dates for display
    const projectedDate = product.projectedCompletion ?
        new Date(product.projectedCompletion).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) : 'TBD';

    const requiredDate = product.deliveryDate ?
        new Date(product.deliveryDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) : 'TBD';

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <div class="product-header">
            <div class="product-name">${product.name}</div>
            <div class="status-badge ${status}">${status.replace('-', ' ')}</div>
        </div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${product.progress}%"></div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; padding: 10px; background: #f9fafb; border-radius: 6px;">
            <div>
                <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Required</div>
                <div style="font-size: 13px; font-weight: 600; color: #374151;">${requiredDate}</div>
            </div>
            <div>
                <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Projected</div>
                <div style="font-size: 13px; font-weight: 600; color: ${product.onTime ? '#10b981' : '#ef4444'};">${projectedDate}</div>
            </div>
        </div>
        <div class="product-stats">
            <span>📅 ${product.daysRemaining} days remaining</span>
            <span>⚡ ${product.criticalPath} critical tasks</span>
        </div>
        <div class="product-stats" style="margin-top: 5px; font-size: 11px;">
            <span>Tasks: ${product.totalTasks}</span>
            ${product.latePartsCount > 0 ? `<span>📦 Late Parts: ${product.latePartsCount}</span>` : ''}
            ${product.reworkCount > 0 ? `<span>🔧 Rework: ${product.reworkCount}</span>` : ''}
            ${product.customerCount > 0 ? `<span>👤 Customer: ${product.customerCount}</span>` : ''}
        </div>
        ${product.latenessDays > 0 ? `
            <div style="margin-top: 8px; padding: 5px; background: #fee2e2; border-radius: 4px; font-size: 12px; text-align: center;">
                <strong>Late by ${product.latenessDays} days</strong>
                ${product.projectedCompletion && product.deliveryDate ?
                    `<div style="font-size: 11px; margin-top: 2px;">Projected: ${projectedDate} | Required: ${requiredDate}</div>` : ''}
            </div>
        ` : product.latenessDays < 0 ? `
            <div style="margin-top: 8px; padding: 5px; background: #d1fae5; border-radius: 4px; font-size: 12px; text-align: center;">
                <strong>Early by ${Math.abs(product.latenessDays)} days</strong>
            </div>
        ` : ''}
    `;
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => showProductDetails(product.name));
    productGrid.appendChild(card);
});

    // Build utilization data structure with sorting and aggregation
    buildUtilizationDisplay();
}

// New function to handle utilization display with controls
function buildUtilizationDisplay() {
    const utilizationChart = document.getElementById('utilizationChart');

    // Add control panel if it doesn't exist
    let controlPanel = document.getElementById('utilizationControls');
    if (!controlPanel) {
        const chartContainer = utilizationChart.parentElement;
        controlPanel = document.createElement('div');
        controlPanel.id = 'utilizationControls';
        controlPanel.style.cssText = `
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
            align-items: center;
            flex-wrap: wrap;
        `;
        controlPanel.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center;">
                <label style="font-weight: 500; color: #6b7280; font-size: 14px;">View:</label>
                <select id="utilizationView" style="padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                    <option value="all">All Teams</option>
                    <option value="role">Group by Role</option>
                    <option value="skill">Group by Skill</option>
                    <option value="mechanic-skill">Mechanic Skills Only</option>
                </select>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <label style="font-weight: 500; color: #6b7280; font-size: 14px;">Sort:</label>
                <select id="utilizationSort" style="padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                    <option value="name">Name</option>
                    <option value="util-high">Utilization (High to Low)</option>
                    <option value="util-low">Utilization (Low to High)</option>
                </select>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <label style="font-weight: 500; color: #6b7280; font-size: 14px;">Filter:</label>
                <input type="number" id="utilizationThreshold" placeholder="Min %" style="width: 60px; padding: 6px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                <button onclick="applyUtilizationFilter()" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Apply</button>
            </div>
        `;
        chartContainer.insertBefore(controlPanel, utilizationChart);

        // Add event listeners
        document.getElementById('utilizationView').addEventListener('change', updateUtilizationDisplay);
        document.getElementById('utilizationSort').addEventListener('change', updateUtilizationDisplay);
    }

    // Initial display
    updateUtilizationDisplay();
}

// Function to update utilization display based on controls
function updateUtilizationDisplay() {
    const utilizationChart = document.getElementById('utilizationChart');
    const viewMode = document.getElementById('utilizationView').value;
    const sortMode = document.getElementById('utilizationSort').value;
    const threshold = parseFloat(document.getElementById('utilizationThreshold').value) || 0;

    utilizationChart.innerHTML = '';

    // Process data based on view mode
    let utilizationData = [];

    if (viewMode === 'all') {
        // Show all teams individually
        Object.entries(scenarioData.utilization).forEach(([team, utilization]) => {
            if (utilization >= threshold) {
                utilizationData.push({ name: team, utilization: utilization, type: getTeamType(team) });
            }
        });
    } else if (viewMode === 'role') {
        // Aggregate by role (Mechanic, Quality, Customer)
        const roleAggregation = { Mechanic: [], Quality: [], Customer: [] };

        Object.entries(scenarioData.utilization).forEach(([team, utilization]) => {
            const type = getTeamType(team);
            if (roleAggregation[type]) {
                roleAggregation[type].push(utilization);
            }
        });

        Object.entries(roleAggregation).forEach(([role, utils]) => {
            if (utils.length > 0) {
                const avgUtil = utils.reduce((a, b) => a + b, 0) / utils.length;
                if (avgUtil >= threshold) {
                    utilizationData.push({
                        name: `${role} Teams (${utils.length} teams)`,
                        utilization: Math.round(avgUtil * 10) / 10,
                        type: role,
                        count: utils.length,
                        min: Math.min(...utils),
                        max: Math.max(...utils)
                    });
                }
            }
        });
    } else if (viewMode === 'skill') {
        // Aggregate by skill across all teams
        const skillAggregation = {};

        Object.entries(scenarioData.utilization).forEach(([team, utilization]) => {
            const skillMatch = team.match(/\(([^)]+)\)/);
            const skill = skillMatch ? skillMatch[1] : 'No Skill';

            if (!skillAggregation[skill]) {
                skillAggregation[skill] = [];
            }
            skillAggregation[skill].push(utilization);
        });

        Object.entries(skillAggregation).forEach(([skill, utils]) => {
            const avgUtil = utils.reduce((a, b) => a + b, 0) / utils.length;
            if (avgUtil >= threshold) {
                utilizationData.push({
                    name: `Skill: ${skill} (${utils.length} teams)`,
                    utilization: Math.round(avgUtil * 10) / 10,
                    type: 'skill',
                    count: utils.length
                });
            }
        });
    } else if (viewMode === 'mechanic-skill') {
        // Show only mechanic teams grouped by skill
        const mechanicSkills = {};

        Object.entries(scenarioData.utilization).forEach(([team, utilization]) => {
            if (team.includes('Mechanic')) {
                const skillMatch = team.match(/\(([^)]+)\)/);
                const skill = skillMatch ? skillMatch[1] : 'General';

                if (!mechanicSkills[skill]) {
                    mechanicSkills[skill] = { teams: [], total: 0 };
                }
                mechanicSkills[skill].teams.push({ team, utilization });
                mechanicSkills[skill].total += utilization;
            }
        });

        Object.entries(mechanicSkills).forEach(([skill, data]) => {
            const avgUtil = data.total / data.teams.length;
            if (avgUtil >= threshold) {
                // Add skill group header
                utilizationData.push({
                    name: `Mechanic Skill ${skill}`,
                    utilization: Math.round(avgUtil * 10) / 10,
                    type: 'skill-header',
                    isGroup: true
                });
                // Add individual teams under this skill
                data.teams.forEach(({ team, utilization }) => {
                    if (utilization >= threshold) {
                        utilizationData.push({
                            name: `  ${team}`,
                            utilization: utilization,
                            type: 'Mechanic',
                            indent: true
                        });
                    }
                });
            }
        });
    }

    // Sort data
    if (sortMode === 'util-high') {
        utilizationData.sort((a, b) => b.utilization - a.utilization);
    } else if (sortMode === 'util-low') {
        utilizationData.sort((a, b) => a.utilization - b.utilization);
    } else {
        utilizationData.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Display data
    utilizationData.forEach(data => {
        const item = document.createElement('div');
        item.className = 'utilization-item';
        if (data.indent) {
            item.style.marginLeft = '20px';
        }
        if (data.isGroup) {
            item.style.background = '#f3f4f6';
            item.style.padding = '8px';
            item.style.borderRadius = '6px';
            item.style.marginTop = '10px';
            item.style.marginBottom = '5px';
        }

        let fillColor = 'linear-gradient(90deg, #10b981, #10b981)';
        if (data.utilization > 90) {
            fillColor = 'linear-gradient(90deg, #ef4444, #ef4444)';
        } else if (data.utilization > 75) {
            fillColor = 'linear-gradient(90deg, #f59e0b, #f59e0b)';
        }

        let labelHTML = data.name;
        if (data.count !== undefined && data.min !== undefined) {
            labelHTML += `<br><span style="font-size: 11px; color: #9ca3af;">Range: ${Math.round(data.min)}% - ${Math.round(data.max)}%</span>`;
        }

        item.innerHTML = `
            <div class="team-label" style="${data.isGroup ? 'font-weight: 600;' : ''}">${labelHTML}</div>
            <div class="utilization-bar">
                <div class="utilization-fill" style="width: ${data.utilization}%; background: ${fillColor};">
                    <span class="utilization-percent">${data.utilization}%</span>
                </div>
            </div>
        `;
        utilizationChart.appendChild(item);
    });

    // Add summary at bottom
    const summary = document.createElement('div');
    summary.style.cssText = `
        margin-top: 20px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 8px;
        font-size: 13px;
        color: #6b7280;
    `;
    summary.innerHTML = `
        <strong>Summary:</strong> Showing ${utilizationData.filter(d => !d.isGroup).length} items
        ${threshold > 0 ? ` (filtered >= ${threshold}%)` : ''}
    `;
    utilizationChart.appendChild(summary);
}

// Helper function to determine team type
function getTeamType(teamName) {
    if (teamName.toLowerCase().includes('customer')) return 'Customer';
    if (teamName.toLowerCase().includes('quality')) return 'Quality';
    if (teamName.toLowerCase().includes('mechanic')) return 'Mechanic';
    return 'Other';
}

// Apply utilization filter
window.applyUtilizationFilter = function() {
    updateUtilizationDisplay();
}

// Show product details (new feature)
async function showProductDetails(productName) {
    try {
        const response = await fetch(`/api/product/${productName}/tasks?scenario=${currentScenario}`);
        const data = await response.json();
        if (response.ok) {
            alert(`${productName}: ${data.totalTasks} total tasks\n` +
                `Production: ${data.taskBreakdown.Production || 0}\n` +
                `Quality: ${data.taskBreakdown['Quality Inspection'] || 0}\n` +
                `Late Parts: ${data.taskBreakdown['Late Part'] || 0}\n` +
                `Rework: ${data.taskBreakdown.Rework || 0}`);
        }
    } catch (error) {
        console.error('Error loading product details:', error);
    }
}

// Enhanced Individual Mechanic View with Team Grouping and Skill Filtering
async function updateMechanicView() {
    if (!scenarioData) return;

    // First, populate the mechanic dropdown with team groupings
    const mechanicSelect = document.getElementById('mechanicSelect');
    if (mechanicSelect) {
        const currentSelection = mechanicSelect.value;
        mechanicSelect.innerHTML = '';

        // Add group view options at the top
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = '📊 All Workers (Aggregated View)';
        mechanicSelect.appendChild(allOption);

        const allMechOption = document.createElement('option');
        allMechOption.value = 'all-mechanics';
        allMechOption.textContent = '🔧 All Mechanics (Aggregated)';
        mechanicSelect.appendChild(allMechOption);

        const allQualOption = document.createElement('option');
        allQualOption.value = 'all-quality';
        allQualOption.textContent = '✓ All Quality Inspectors (Aggregated)';
        mechanicSelect.appendChild(allQualOption);

        // Add All Customers option
        const allCustOption = document.createElement('option');
        allCustOption.value = 'all-customer';
        allCustOption.textContent = '👤 All Customers (Aggregated)';
        mechanicSelect.appendChild(allCustOption);

        // Add separator
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '─────────────────────';
        mechanicSelect.appendChild(separator);

        // Build team structure with skills - ONLY include workers with assignments
        const teamStructure = {};
        const assignedWorkers = new Set();

        // First, identify which workers have assignments
        if (savedAssignments[currentScenario] && savedAssignments[currentScenario].mechanicSchedules) {
            Object.keys(savedAssignments[currentScenario].mechanicSchedules).forEach(workerId => {
                const schedule = savedAssignments[currentScenario].mechanicSchedules[workerId];
                if (schedule.tasks && schedule.tasks.length > 0) {
                    assignedWorkers.add(workerId);
                }
            });
        }

        // Only process workers who have assignments
        assignedWorkers.forEach(workerId => {
            const schedule = savedAssignments[currentScenario].mechanicSchedules[workerId];
            const teamSkill = schedule.teamSkill || workerId.split('_')[0];
            const baseTeam = schedule.team || teamSkill.split(' (')[0];

            if (!teamStructure[baseTeam]) {
                teamStructure[baseTeam] = {
                    workers: [],
                    isQuality: baseTeam.toLowerCase().includes('quality'),
                    isCustomer: baseTeam.toLowerCase().includes('customer')
                };
            }

            teamStructure[baseTeam].workers.push({
                id: workerId,
                displayName: schedule.displayName || workerId,
                taskCount: schedule.tasks ? schedule.tasks.length : 0
            });
        });

        // Sort teams: Mechanics first, then Quality, then Customer
        const sortedTeams = Object.keys(teamStructure).sort((a, b) => {
            const aCustomer = teamStructure[a].isCustomer;
            const bCustomer = teamStructure[b].isCustomer;
            const aQual = teamStructure[a].isQuality;
            const bQual = teamStructure[b].isQuality;

            if (aCustomer !== bCustomer) return aCustomer ? 1 : -1;
            if (aQual !== bQual) return aQual ? 1 : -1;
            return a.localeCompare(b);
        });

        // Add teams with their workers
        sortedTeams.forEach(baseTeam => {
            const teamInfo = teamStructure[baseTeam];

            // Only create optgroup if there are workers
            if (teamInfo.workers.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = `${baseTeam} (${teamInfo.workers.length} active)`;

                // Add team-level aggregated option if multiple workers
                if (teamInfo.workers.length > 1) {
                    const teamOption = document.createElement('option');
                    teamOption.value = `team:${baseTeam}`;
                    teamOption.textContent = `📊 All ${baseTeam} (${teamInfo.workers.length} workers)`;
                    teamOption.style.fontWeight = 'bold';
                    optgroup.appendChild(teamOption);
                }

                // Add individual workers
                teamInfo.workers.forEach(worker => {
                    const option = document.createElement('option');
                    option.value = worker.id;

                    // Use proper role names based on team type
                    let label;
                    if (teamInfo.isCustomer) {
                        // Extract worker number from ID
                        const workerNum = worker.id.split('_').pop();
                        label = `  Customer #${workerNum} (${worker.taskCount} tasks)`;
                    } else if (teamInfo.isQuality) {
                        const workerNum = worker.id.split('_').pop();
                        label = `  Inspector #${workerNum} (${worker.taskCount} tasks)`;
                    } else {
                        const workerNum = worker.id.split('_').pop();
                        label = `  Mechanic #${workerNum} (${worker.taskCount} tasks)`;
                    }

                    option.textContent = label;
                    optgroup.appendChild(option);
                });

                mechanicSelect.appendChild(optgroup);
            }
        });

        // If no workers have assignments, show a message
        if (assignedWorkers.size === 0) {
            const noAssignOption = document.createElement('option');
            noAssignOption.value = 'none';
            noAssignOption.textContent = 'No workers have assignments yet';
            noAssignOption.disabled = true;
            mechanicSelect.appendChild(noAssignOption);
        }

        // Restore selection if it still exists
        if ([...mechanicSelect.options].some(opt => opt.value === currentSelection)) {
            mechanicSelect.value = currentSelection;
        } else if (mechanicSelect.options.length > 0) {
            mechanicSelect.value = 'all';
        }
    }

    // Get selected mechanic/team and display schedule
    const selection = document.getElementById('mechanicSelect').value;

    if (!selection || selection === 'none') {
        displayNoSelection();
        return;
    }

    // Determine what type of view to show
    let viewType = 'individual';
    let viewData = null;

    if (selection === 'all' || selection === 'all-mechanics' || selection === 'all-quality' || selection === 'all-customer') {
        viewType = 'aggregate';
        viewData = getAggregatedTasks(selection, 'all');
    } else if (selection.startsWith('team:')) {
        viewType = 'team';
        const teamName = selection.substring(5);
        viewData = getTeamTasks(teamName, 'all');
    } else {
        // Individual mechanic view
        viewType = 'individual';
        viewData = getIndividualMechanicTasks(selection);
    }

    // Display the appropriate view
    if (viewType === 'aggregate' || viewType === 'team') {
        displayAggregatedView(viewData, viewType, selection);
    } else {
        displayIndividualView(viewData, selection);
    }
}

function displayAggregatedView(viewData, viewType, selection) {
    const { tasks, mechanics, totalMechanics, teamName } = viewData;

    // Update header
    let headerText = '';
    if (selection === 'all') {
        headerText = 'All Workers Schedule';
    } else if (selection === 'all-mechanics') {
        headerText = 'All Mechanics Schedule';
    } else if (selection === 'all-quality') {
        headerText = 'All Quality Inspectors Schedule';
    } else if (selection === 'all-customer') {
        headerText = 'All Customer Inspectors Schedule';
    } else if (viewType === 'team') {
        headerText = `${teamName} Team Schedule`;
    }

    const mechanicNameElement = document.getElementById('mechanicName');
    if (mechanicNameElement) {
        mechanicNameElement.textContent = headerText;
    }

    // Build timeline with worker assignments
    const timeline = document.getElementById('mechanicTimeline');
    if (!timeline) return;

    timeline.innerHTML = '';

    if (tasks.length === 0) {
        timeline.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                <div style="font-size: 16px; font-weight: 500;">No Tasks Assigned</div>
                <div style="font-size: 14px; margin-top: 5px;">Use the Team Lead view to assign tasks first</div>
            </div>
        `;
        return;
    }

    // Add summary header
    const summaryHeader = document.createElement('div');
    summaryHeader.style.cssText = `
        background: #e0f2fe;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 15px;
    `;
    summaryHeader.innerHTML = `
        <strong>Coverage Summary</strong><br>
        Total Workers: ${totalMechanics}<br>
        Total Tasks: ${tasks.length}<br>
        ${Object.values(mechanics).map(m => `${m.name}: ${m.taskCount} tasks`).slice(0, 3).join('<br>')}
        ${totalMechanics > 3 ? `<br>...and ${totalMechanics - 3} more workers` : ''}
    `;
    timeline.appendChild(summaryHeader);

    // Group tasks by date first, then by time slots
    const tasksByDate = {};
    tasks.forEach(task => {
        const startTime = new Date(task.startTime);
        const dateKey = startTime.toDateString();

        if (!tasksByDate[dateKey]) {
            tasksByDate[dateKey] = {};
        }

        const timeKey = startTime.toISOString();
        if (!tasksByDate[dateKey][timeKey]) {
            tasksByDate[dateKey][timeKey] = [];
        }
        tasksByDate[dateKey][timeKey].push(task);
    });

    // Sort dates and limit total displayed items
    const sortedDates = Object.keys(tasksByDate).sort((a, b) =>
        new Date(a) - new Date(b)
    );

    let totalSlotsDisplayed = 0;
    const maxSlots = 50;

    sortedDates.forEach(dateStr => {
        if (totalSlotsDisplayed >= maxSlots) return;

        // Add date header
        const dateHeader = document.createElement('div');
        dateHeader.style.cssText = `
            background: #f3f4f6;
            padding: 8px 12px;
            font-weight: 600;
            color: #374151;
            margin: 15px 0 5px 0;
            border-radius: 6px;
            border-left: 3px solid #3b82f6;
        `;
        dateHeader.textContent = new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        timeline.appendChild(dateHeader);

        // Sort time slots within this date
        const timeSlots = tasksByDate[dateStr];
        const sortedTimes = Object.keys(timeSlots).sort();

        sortedTimes.forEach(time => {
            if (totalSlotsDisplayed >= maxSlots) return;

            const slotTasks = timeSlots[time];
            const startTime = new Date(time);

            const slotDiv = document.createElement('div');
            slotDiv.className = 'timeline-item';
            slotDiv.style.borderLeftColor = '#3b82f6';

            const concurrentCount = slotTasks.length;
            const taskList = slotTasks.slice(0, 3).map(t =>
                `${t.taskId} (${t.assignedToName ? t.assignedToName.split(' - ')[0] : 'Unassigned'})`
            ).join(', ');

            slotDiv.innerHTML = `
                <div class="timeline-time">${formatTime(startTime)}</div>
                <div class="timeline-content">
                    <div class="timeline-task">
                        ${concurrentCount} Concurrent Task${concurrentCount > 1 ? 's' : ''}
                    </div>
                    <div class="timeline-details">
                        <span>${taskList}${concurrentCount > 3 ? ` +${concurrentCount - 3} more` : ''}</span>
                    </div>
                </div>
            `;

            timeline.appendChild(slotDiv);
            totalSlotsDisplayed++;
        });
    });

    // Add workload distribution
    const workloadDiv = document.createElement('div');
    workloadDiv.style.cssText = `
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        margin-top: 20px;
    `;

    const totalMinutes = tasks.reduce((sum, t) => sum + (t.duration || 60), 0);
    const avgMinutesPerWorker = totalMechanics > 0 ? Math.round(totalMinutes / totalMechanics) : 0;

    workloadDiv.innerHTML = `
        <strong>Workload Analysis</strong><br>
        Total Work: ${Math.round(totalMinutes / 60)} hours<br>
        Average per Worker: ${Math.round(avgMinutesPerWorker / 60 * 10) / 10} hours<br>
        Utilization: ${Math.round(avgMinutesPerWorker / 480 * 100)}% (based on 8-hour shift)
    `;

    timeline.appendChild(workloadDiv);
}

function displayIndividualView(mechanicSchedule, mechanicId) {
    const mechanicNameElement = document.getElementById('mechanicName');
    const timeline = document.getElementById('mechanicTimeline');

    if (!timeline) return;

    if (!mechanicSchedule) {
        if (mechanicNameElement) {
            mechanicNameElement.textContent = 'Task Schedule';
        }
        timeline.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                <div style="font-size: 16px; font-weight: 500;">No Tasks Assigned</div>
                <div style="font-size: 14px; margin-top: 5px;">Use the Team Lead view to assign tasks</div>
            </div>
        `;
        return;
    }

    const mechanicTasks = mechanicSchedule.tasks || [];

    // Update header
    if (mechanicNameElement) {
        mechanicNameElement.textContent =
            `Task Schedule for ${mechanicSchedule.displayName || mechanicId}`;
    }

    // Build timeline
    timeline.innerHTML = '';

    if (mechanicTasks.length === 0) {
        timeline.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
                <div style="font-size: 16px; font-weight: 500;">No Tasks Assigned</div>
                <div style="font-size: 14px; margin-top: 5px;">Use the Team Lead view to assign tasks</div>
            </div>
        `;
        return;
    }

    // Group tasks by date
    const tasksByDate = {};
    mechanicTasks.forEach(task => {
        const date = new Date(task.startTime).toDateString();
        if (!tasksByDate[date]) {
            tasksByDate[date] = [];
        }
        tasksByDate[date].push(task);
    });

    // Display tasks
    Object.entries(tasksByDate).forEach(([date, tasks]) => {
        const dateHeader = document.createElement('div');
        dateHeader.style.cssText = `
            background: #f3f4f6;
            padding: 8px 12px;
            font-weight: 600;
            color: #374151;
            margin: 10px 0 5px 0;
            border-radius: 6px;
        `;
        dateHeader.textContent = date;
        timeline.appendChild(dateHeader);

        tasks.forEach(task => {
            const startTime = new Date(task.startTime);
            const item = document.createElement('div');
            item.className = 'timeline-item';

            let borderColor = '#3b82f6';
            let typeIcon = '🔧';

            if (task.type === 'Quality Inspection') {
                borderColor = '#10b981';
                typeIcon = '✔';
            } else if (task.type === 'Late Part') {
                borderColor = '#f59e0b';
                typeIcon = '📦';
            } else if (task.type === 'Rework') {
                borderColor = '#ef4444';
                typeIcon = '🔄';
            }

            item.style.borderLeftColor = borderColor;
            item.innerHTML = `
                <div class="timeline-time">${formatTime(startTime)}</div>
                <div class="timeline-content">
                    <div class="timeline-task">
                        ${typeIcon} Task ${task.taskId} - ${task.type}
                    </div>
                    <div class="timeline-details">
                        <span>📦 ${task.product}</span>
                        <span>⏱️ ${task.duration} minutes</span>
                    </div>
                </div>
            `;
            timeline.appendChild(item);
        });
    });
}

function displayNoSelection() {
    const mechanicNameElement = document.getElementById('mechanicName');
    const timeline = document.getElementById('mechanicTimeline');

    if (mechanicNameElement) {
        mechanicNameElement.textContent = 'Task Schedule';
    }

    if (timeline) {
        timeline.innerHTML =
            '<div style="padding: 20px; color: #6b7280;">Select a worker or team to view schedule</div>';
    }
}

// Also add these helper functions if they don't exist:
function getAggregatedTasks(selection, skillFilter) {
    const allTasks = [];
    const mechanicsSummary = {};

    if (!savedAssignments[currentScenario] || !savedAssignments[currentScenario].mechanicSchedules) {
        return { tasks: [], mechanics: {}, totalMechanics: 0 };
    }

    const schedules = savedAssignments[currentScenario].mechanicSchedules;

    Object.entries(schedules).forEach(([mechanicId, schedule]) => {
        // Determine if this worker should be included based on selection
        let include = false;
        const isQuality = schedule.isQuality || (schedule.team && schedule.team.toLowerCase().includes('quality'));
        const isCustomer = schedule.isCustomer || (schedule.team && schedule.team.toLowerCase().includes('customer'));

        if (selection === 'all') {
            include = true;
        } else if (selection === 'all-mechanics' && !isQuality && !isCustomer) {
            include = true;
        } else if (selection === 'all-quality' && isQuality) {
            include = true;
        } else if (selection === 'all-customer' && isCustomer) {
            include = true;
        }

        if (include) {
            // Add mechanic to summary
            mechanicsSummary[mechanicId] = {
                name: schedule.displayName || mechanicId,
                taskCount: schedule.tasks ? schedule.tasks.length : 0,
                team: schedule.team,
                skill: schedule.skill
            };

            // Add tasks with mechanic info
            if (schedule.tasks) {
                schedule.tasks.forEach(task => {
                    allTasks.push({
                        ...task,
                        assignedTo: mechanicId,
                        assignedToName: schedule.displayName || mechanicId
                    });
                });
            }
        }
    });

    // Sort tasks by start time
    allTasks.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    return {
        tasks: allTasks,
        mechanics: mechanicsSummary,
        totalMechanics: Object.keys(mechanicsSummary).length
    };
}

function getTeamTasks(teamName, skillFilter) {
    const teamTasks = [];
    const mechanicsSummary = {};

    if (!savedAssignments[currentScenario] || !savedAssignments[currentScenario].mechanicSchedules) {
        return { tasks: [], mechanics: {}, totalMechanics: 0, teamName: teamName };
    }

    const schedules = savedAssignments[currentScenario].mechanicSchedules;

    Object.entries(schedules).forEach(([mechanicId, schedule]) => {
        // Check if this mechanic belongs to the selected team
        if (schedule.team === teamName || mechanicId.includes(teamName)) {
            // Parse skill
            const teamSkillMatch = mechanicId.match(/^(.+?)_\d+$/);
            const teamSkill = teamSkillMatch ? teamSkillMatch[1] : mechanicId;
            const skillMatch = teamSkill.match(/\((.+?)\)/);
            const skill = skillMatch ? skillMatch[1] : null;

            // Apply skill filter
            if (skillFilter === 'all' || skill === skillFilter) {
                mechanicsSummary[mechanicId] = {
                    name: schedule.displayName || mechanicId,
                    taskCount: schedule.tasks ? schedule.tasks.length : 0,
                    skill: skill
                };

                if (schedule.tasks) {
                    schedule.tasks.forEach(task => {
                        teamTasks.push({
                            ...task,
                            assignedTo: mechanicId,
                            assignedToName: schedule.displayName || mechanicId
                        });
                    });
                }
            }
        }
    });

    // Sort tasks by start time
    teamTasks.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    return {
        tasks: teamTasks,
        mechanics: mechanicsSummary,
        totalMechanics: Object.keys(mechanicsSummary).length,
        teamName: teamName
    };
}

function getIndividualMechanicTasks(mechanicId) {
    if (!savedAssignments[currentScenario] || !savedAssignments[currentScenario].mechanicSchedules) {
        return null;
    }

    return savedAssignments[currentScenario].mechanicSchedules[mechanicId];
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Helper functions
function getTaskTypeClass(type) {
    const typeMap = {
        'Production': 'production',
        'Quality Inspection': 'quality',
        'Customer Inspection': 'customer',
        'Late Part': 'late-part',
        'Rework': 'rework'
    };
    return typeMap[type] || 'production';
}

function getTaskTypeColor(type) {
    const colorMap = {
        'Production': '#10b981',
        'Quality Inspection': '#3b82f6',
        'Customer Inspection': '#8b5cf6',  // Purple for customer
        'Late Part': '#f59e0b',
        'Rework': '#ef4444'
    };
    return colorMap[type] || '#6b7280';
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Gantt chart helpers
function getGanttColor(product, isCritical) {
    const productColors = {
        'Product A': 'gantt-prod-a',
        'Product B': 'gantt-prod-b',
        'Product C': 'gantt-prod-c',
        'Product D': 'gantt-prod-d',
        'Product E': 'gantt-prod-e'
    };
    let classes = '';
    if (productColors[product]) {
        classes += productColors[product];
    }
    if (isCritical) {
        classes += ' gantt-critical';
    }
    return classes.trim();
}

// Replace all your Gantt chart functions in dashboard-js.js with these vis.js Timeline functions

let timeline = null;
let timelineContainer = null;
let currentTimelineData = [];
let currentTimelineGroups = [];

// Enhanced timeline initialization with custom time scales
function initializeTimeline() {
    console.log('Starting timeline initialization...');

    timelineContainer = document.getElementById('timelineVisualization');
    if (!timelineContainer) {
        console.error('Timeline container not found');
        return;
    }

    if (typeof vis === 'undefined') {
        console.error('vis.js library not loaded');
        timelineContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <h3>Timeline Library Missing</h3>
                <p>Please refresh the page to load the timeline library.</p>
            </div>
        `;
        return;
    }

    // Clear any existing timeline
    if (timeline) {
        timeline.destroy();
        timeline = null;
    }

    // Get current time scale setting
    const timeScale = document.getElementById('timelineScale')?.value || '1day';
    const timelineOptions = getTimelineOptions(timeScale);

    try {
        timeline = new vis.Timeline(timelineContainer, [], [], timelineOptions);
        console.log(`Timeline created successfully with ${timeScale} scale`);

        setupTimelineEventListeners();

        // Set initial focus date to now
        const focusDateInput = document.getElementById('timelineFocusDate');
        if (focusDateInput && !focusDateInput.value) {
            focusDateInput.value = new Date().toISOString().slice(0, 16);
        }

        renderTimeline();

    } catch (error) {
        console.error('Error creating timeline:', error);
        timelineContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <h3>Timeline Creation Error</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Refresh Page</button>
            </div>
        `;
    }
}

// Get timeline options based on selected time scale
function getTimelineOptions(timeScale) {
    const baseOptions = {
        stack: true,
        showCurrentTime: true,
        zoomable: true,
        moveable: true,
        selectable: true,
        multiselect: false,
        editable: false,
        orientation: 'top',
        height: '600px',
        margin: {
            item: 2,
            axis: 20
        },
        tooltip: {
            followMouse: true,
            overflowMethod: 'cap'
        }
    };

    // Custom format and zoom settings based on time scale
    const scaleConfigs = {
        '15min': {
            format: {
                minorLabels: {
                    minute: 'mm',
                    hour: 'HH:mm'
                },
                majorLabels: {
                    minute: 'HH:mm',
                    hour: 'ddd D MMMM HH:mm',
                    day: 'ddd D MMMM YYYY'
                }
            },
            zoomMin: 1000 * 60 * 15, // 15 minutes
            zoomMax: 1000 * 60 * 60 * 8, // 8 hours
            timeAxis: { scale: 'minute', step: 15 }
        },
        '30min': {
            format: {
                minorLabels: {
                    minute: 'HH:mm',
                    hour: 'HH:mm'
                },
                majorLabels: {
                    minute: 'HH:mm',
                    hour: 'ddd D MMMM HH:mm',
                    day: 'ddd D MMMM YYYY'
                }
            },
            zoomMin: 1000 * 60 * 30, // 30 minutes
            zoomMax: 1000 * 60 * 60 * 12, // 12 hours
            timeAxis: { scale: 'minute', step: 30 }
        },
        '1hour': {
            format: {
                minorLabels: {
                    hour: 'HH:mm',
                    day: 'D'
                },
                majorLabels: {
                    hour: 'ddd D MMMM',
                    day: 'MMMM YYYY'
                }
            },
            zoomMin: 1000 * 60 * 60, // 1 hour
            zoomMax: 1000 * 60 * 60 * 24, // 1 day
            timeAxis: { scale: 'hour', step: 1 }
        },
        '4hour': {
            format: {
                minorLabels: {
                    hour: 'HH:mm',
                    day: 'D'
                },
                majorLabels: {
                    hour: 'ddd D MMMM',
                    day: 'MMMM YYYY'
                }
            },
            zoomMin: 1000 * 60 * 60 * 4, // 4 hours
            zoomMax: 1000 * 60 * 60 * 24 * 3, // 3 days
            timeAxis: { scale: 'hour', step: 4 }
        },
        '8hour': {
            format: {
                minorLabels: {
                    hour: 'HH:mm',
                    day: 'D'
                },
                majorLabels: {
                    hour: 'ddd D MMMM',
                    day: 'MMMM YYYY'
                }
            },
            zoomMin: 1000 * 60 * 60 * 8, // 8 hours
            zoomMax: 1000 * 60 * 60 * 24 * 7, // 1 week
            timeAxis: { scale: 'hour', step: 8 }
        },
        '1day': {
            format: {
                minorLabels: {
                    day: 'D',
                    week: 'w'
                },
                majorLabels: {
                    day: 'MMMM YYYY',
                    week: 'MMMM YYYY',
                    month: 'YYYY'
                }
            },
            zoomMin: 1000 * 60 * 60 * 24, // 1 day
            zoomMax: 1000 * 60 * 60 * 24 * 31, // 1 month
            timeAxis: { scale: 'day', step: 1 }
        },
        '1week': {
            format: {
                minorLabels: {
                    week: 'w',
                    month: 'MMM'
                },
                majorLabels: {
                    week: 'MMMM YYYY',
                    month: 'YYYY'
                }
            },
            zoomMin: 1000 * 60 * 60 * 24 * 7, // 1 week
            zoomMax: 1000 * 60 * 60 * 24 * 365, // 1 year
            timeAxis: { scale: 'week', step: 1 }
        },
        '2weeks': {
            format: {
                minorLabels: {
                    week: 'w',
                    month: 'MMM'
                },
                majorLabels: {
                    week: 'MMMM YYYY',
                    month: 'YYYY'
                }
            },
            zoomMin: 1000 * 60 * 60 * 24 * 14, // 2 weeks
            zoomMax: 1000 * 60 * 60 * 24 * 365, // 1 year
            timeAxis: { scale: 'week', step: 2 }
        },
        '1month': {
            format: {
                minorLabels: {
                    month: 'MMM',
                    year: 'YYYY'
                },
                majorLabels: {
                    month: 'YYYY',
                    year: ''
                }
            },
            zoomMin: 1000 * 60 * 60 * 24 * 30, // 1 month
            zoomMax: 1000 * 60 * 60 * 24 * 365 * 5, // 5 years
            timeAxis: { scale: 'month', step: 1 }
        }
    };

    const config = scaleConfigs[timeScale] || scaleConfigs['1day'];

    return {
        ...baseOptions,
        ...config
    };
}

// Enhanced event listener setup with time scale handling
function setupTimelineEventListeners() {
    if (!timeline) return;

    // Product filter
    const productSelect = document.getElementById('timelineProductSelect');
    if (productSelect) {
        productSelect.addEventListener('change', renderTimeline);
    }

    // Team filter
    const teamSelect = document.getElementById('timelineTeamSelect');
    if (teamSelect) {
        teamSelect.addEventListener('change', renderTimeline);
    }

    // Time scale selector
    const scaleSelect = document.getElementById('timelineScale');
    if (scaleSelect) {
        scaleSelect.addEventListener('change', function() {
            // Reinitialize timeline with new scale
            const currentWindow = timeline.getWindow();
            initializeTimeline();
            // Try to maintain current view if possible
            setTimeout(() => {
                if (timeline && currentWindow) {
                    timeline.setWindow(currentWindow.start, currentWindow.end);
                }
            }, 100);
        });
    }

    // Group by selector
    const groupBySelect = document.getElementById('timelineGroupBy');
    if (groupBySelect) {
        groupBySelect.addEventListener('change', renderTimeline);
    }

    // Focus date input
    const focusDateInput = document.getElementById('timelineFocusDate');
    if (focusDateInput) {
        focusDateInput.addEventListener('change', function() {
            if (this.value) {
                goToDate(new Date(this.value));
            }
        });
    }

    // Timeline event handlers
    timeline.on('select', function (properties) {
        if (properties.items.length > 0) {
            const itemId = properties.items[0];
            const item = currentTimelineData.find(d => d.id === itemId);
            if (item) {
                showTaskDetails(item);
            }
        }
    });

    timeline.on('doubleClick', function (properties) {
        if (properties.time) {
            focusOnTime(new Date(properties.time));
        }
    });

    // Update focus date input when timeline window changes
    timeline.on('rangechange', function (properties) {
        const focusDateInput = document.getElementById('timelineFocusDate');
        if (focusDateInput && properties.start && properties.end) {
            const midTime = new Date((properties.start.getTime() + properties.end.getTime()) / 2);
            focusDateInput.value = midTime.toISOString().slice(0, 16);
        }
    });
}


// Go to current time
function goToNow() {
    if (!timeline) return;

    const now = new Date();
    focusOnTime(now);

    // Update focus date input
    const focusDateInput = document.getElementById('timelineFocusDate');
    if (focusDateInput) {
        focusDateInput.value = now.toISOString().slice(0, 16);
    }
}

// Focus on specific date/time
function goToDate(date) {
    if (!timeline || !date) return;

    focusOnTime(date);
}

// Focus on specific time with appropriate window based on scale
function focusOnTime(centerTime) {
    if (!timeline) return;

    const timeScale = document.getElementById('timelineScale')?.value || '1day';
    let windowSize;

    // Set window size based on time scale
    const windowSizes = {
        '15min': 1000 * 60 * 60 * 2,      // 2 hours
        '30min': 1000 * 60 * 60 * 4,      // 4 hours
        '1hour': 1000 * 60 * 60 * 8,      // 8 hours
        '4hour': 1000 * 60 * 60 * 24,     // 1 day
        '8hour': 1000 * 60 * 60 * 24 * 2, // 2 days
        '1day': 1000 * 60 * 60 * 24 * 7,  // 1 week
        '1week': 1000 * 60 * 60 * 24 * 30, // 1 month
        '2weeks': 1000 * 60 * 60 * 24 * 60, // 2 months
        '1month': 1000 * 60 * 60 * 24 * 365 // 1 year
    };

    windowSize = windowSizes[timeScale] || windowSizes['1day'];

    const start = new Date(centerTime.getTime() - windowSize / 2);
    const end = new Date(centerTime.getTime() + windowSize / 2);

    timeline.setWindow(start, end, { animation: true });
}

// Enhanced render function with scale-aware time windows
function renderTimeline() {
    if (!timeline) {
        initializeTimeline();
        return;
    }

    const productFilter = document.getElementById('timelineProductSelect')?.value || 'all';
    const teamFilter = document.getElementById('timelineTeamSelect')?.value || 'all';
    const groupBy = document.getElementById('timelineGroupBy')?.value || 'team';

    const filteredTasks = getTimelineTasks(productFilter, teamFilter);

    if (filteredTasks.length === 0) {
        timeline.setData([]);
        timeline.setGroups([]);
        updateTimelineStats([], []);
        return;
    }

    const timelineItems = convertTasksToTimelineItems(filteredTasks);
    const timelineGroups = createTimelineGroups(filteredTasks, groupBy);

    timeline.setItems(timelineItems);
    timeline.setGroups(timelineGroups);

    currentTimelineData = timelineItems;
    currentTimelineGroups = timelineGroups;

    updateTimelineStats(timelineItems, timelineGroups);
    updateTimelineProductFilter();
}

// Enhanced fit to tasks with scale awareness
function fitTimelineToTasks() {
    if (!timeline || currentTimelineData.length === 0) return;

    const startTimes = currentTimelineData.map(item => new Date(item.start));
    const endTimes = currentTimelineData.map(item => new Date(item.end));
    const minStart = new Date(Math.min(...startTimes));
    const maxEnd = new Date(Math.max(...endTimes));

    // Add padding based on current time scale
    const timeScale = document.getElementById('timelineScale')?.value || '1day';
    const paddings = {
        '15min': 1000 * 60 * 30,           // 30 minutes
        '30min': 1000 * 60 * 60,           // 1 hour
        '1hour': 1000 * 60 * 60 * 2,       // 2 hours
        '4hour': 1000 * 60 * 60 * 4,       // 4 hours
        '8hour': 1000 * 60 * 60 * 8,       // 8 hours
        '1day': 1000 * 60 * 60 * 24,       // 1 day
        '1week': 1000 * 60 * 60 * 24 * 2,  // 2 days
        '2weeks': 1000 * 60 * 60 * 24 * 7, // 1 week
        '1month': 1000 * 60 * 60 * 24 * 14 // 2 weeks
    };

    const padding = paddings[timeScale] || paddings['1day'];

    minStart.setTime(minStart.getTime() - padding);
    maxEnd.setTime(maxEnd.getTime() + padding);

    timeline.setWindow(minStart, maxEnd, { animation: true });
}

// Update timeline statistics with scale info
function updateTimelineStats(items, groups) {
    document.getElementById('timelineTotalTasks').textContent = items.length;
    document.getElementById('timelineGroupsCount').textContent = groups.length;

    if (items.length === 0) {
        document.getElementById('timelineSpan').textContent = '-';
        document.getElementById('timelinePeakConcurrency').textContent = '0';
        return;
    }

    // Calculate time span
    const startTimes = items.map(item => new Date(item.start));
    const endTimes = items.map(item => new Date(item.end));
    const minStart = new Date(Math.min(...startTimes));
    const maxEnd = new Date(Math.max(...endTimes));
    const spanMinutes = Math.round((maxEnd - minStart) / (1000 * 60));

    let spanText;
    if (spanMinutes < 60) {
        spanText = `${spanMinutes}min`;
    } else if (spanMinutes < 60 * 24) {
        const hours = Math.floor(spanMinutes / 60);
        const minutes = spanMinutes % 60;
        spanText = minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
    } else {
        const days = Math.floor(spanMinutes / (60 * 24));
        const hours = Math.floor((spanMinutes % (60 * 24)) / 60);
        spanText = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }

    document.getElementById('timelineSpan').textContent = spanText;

    // Calculate peak concurrency
    const concurrency = calculatePeakConcurrency(items);
    document.getElementById('timelinePeakConcurrency').textContent = concurrency;
}

// Make new functions globally available
window.goToNow = goToNow;
window.goToDate = goToDate;


// Get tasks filtered by product and team
function getTimelineTasks(productFilter, teamFilter) {
    if (!scenarioData || !scenarioData.tasks) return [];

    return scenarioData.tasks.filter(task => {
        // Product filter
        if (productFilter !== 'all' && task.product !== productFilter) {
            return false;
        }

        // Team filter with role aggregation
        if (teamFilter === 'all') {
            return true;
        } else if (teamFilter === 'all-mechanics') {
            return task.team && task.team.toLowerCase().includes('mechanic');
        } else if (teamFilter === 'all-quality') {
            return task.team && task.team.toLowerCase().includes('quality');
        } else if (teamFilter === 'all-customer') {
            return task.team && (task.team.toLowerCase().includes('customer') || task.isCustomerTask);
        } else {
            return task.team === teamFilter;
        }
    });
}

// Convert tasks to vis.js timeline items
function convertTasksToTimelineItems(tasks) {
    return tasks.map(task => {
        const startTime = new Date(task.startTime);
        const endTime = new Date(task.endTime);

        // Determine task type and color - FIX: Remove invalid types for vis.js
        let className = 'task-production';
        let taskType = 'Production';

        if (task.isCustomerTask || task.type === 'Customer' || task.type === 'Customer Inspection') {
            className = 'task-customer';
            taskType = 'Customer';
        } else if (task.type === 'Quality Inspection' || task.team?.toLowerCase().includes('quality')) {
            className = 'task-quality';
            taskType = 'Quality';
        } else if (task.isLatePartTask || task.type === 'Late Part') {
            className = 'task-late-part';
            taskType = 'Late Part';
        } else if (task.isReworkTask || task.type === 'Rework') {
            className = 'task-rework';
            taskType = 'Rework';
        }

        // Add priority indicators
        if (task.isCritical || task.priority <= 10) {
            className += ' task-critical';
        } else if (task.priority <= 20) {
            className += ' task-high-priority';
        }

        // Create tooltip content
        const duration = task.duration || Math.round((endTime - startTime) / (1000 * 60));
        const tooltip = `
            <b>${task.taskId} - ${taskType}</b><br/>
            Product: ${task.product}<br/>
            Team: ${task.team}<br/>
            Duration: ${duration} minutes<br/>
            Start: ${startTime.toLocaleString()}<br/>
            End: ${endTime.toLocaleString()}<br/>
            ${task.priority ? `Priority: ${task.priority}<br/>` : ''}
            ${task.dependencies?.length ? `Dependencies: ${task.dependencies.length}<br/>` : ''}
        `;

        return {
            id: task.taskId,
            content: `${task.taskId}<br/><small>${duration}min</small>`,
            start: startTime,
            end: endTime,
            group: getTaskGroup(task, document.getElementById('timelineGroupBy')?.value || 'team'),
            className: className,
            title: tooltip,
            // FIX: Use standard vis.js item type instead of custom types
            type: 'range',  // vis.js recognizes: 'box', 'point', 'range', 'background'
            // Store original task data
            taskData: task,
            taskType: taskType,  // Keep our custom type separate
            duration: duration,
            priority: task.priority || 999
        };
    });
}


// Create groups for timeline
function createTimelineGroups(tasks, groupBy) {
    const groupMap = new Map();

    tasks.forEach(task => {
        const groupId = getTaskGroup(task, groupBy);
        if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
                id: groupId,
                content: groupId,
                tasks: []
            });
        }
        groupMap.get(groupId).tasks.push(task);
    });

    // Convert to array and add task counts
    return Array.from(groupMap.values()).map(group => ({
        id: group.id,
        content: `${group.content} (${group.tasks.length})`,
        style: getGroupStyle(group.id, groupBy)
    }));
}

// Get group ID for a task
function getTaskGroup(task, groupBy) {
    switch (groupBy) {
        case 'product':
            return task.product || 'Unknown Product';
        case 'type':
            if (task.isCustomerTask || task.type === 'Customer') return 'Customer Tasks';
            if (task.type === 'Quality Inspection') return 'Quality Inspection';
            if (task.isLatePartTask || task.type === 'Late Part') return 'Late Parts';
            if (task.isReworkTask || task.type === 'Rework') return 'Rework';
            return 'Production';
        case 'team':
        default:
            return task.team || 'Unknown Team';
    }
}

// Get group styling
function getGroupStyle(groupId, groupBy) {
    if (groupBy === 'type') {
        if (groupId.includes('Customer')) return 'background-color: #f3e8ff; border-left: 4px solid #8b5cf6;';
        if (groupId.includes('Quality')) return 'background-color: #eff6ff; border-left: 4px solid #3b82f6;';
        if (groupId.includes('Late Part')) return 'background-color: #fefbf3; border-left: 4px solid #f59e0b;';
        if (groupId.includes('Rework')) return 'background-color: #fef2f2; border-left: 4px solid #ef4444;';
        return 'background-color: #f0fdf4; border-left: 4px solid #10b981;';
    }
    return '';
}

// Set timeline window based on range
function setTimelineWindow(range, tasks) {
    if (!timeline || tasks.length === 0) return;

    const now = new Date();
    const taskTimes = tasks.map(t => new Date(t.startTime));
    const minTime = new Date(Math.min(...taskTimes));
    const maxTime = new Date(Math.max(...tasks.map(t => new Date(t.endTime))));

    let start, end;

    switch (range) {
        case 'day':
            start = new Date(minTime);
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(end.getDate() + 1);
            break;
        case 'week':
            start = new Date(minTime);
            start.setDate(start.getDate() - start.getDay());
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(end.getDate() + 7);
            break;
        case 'month':
        default:
            start = new Date(minTime);
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end = new Date(maxTime);
            end.setMonth(end.getMonth() + 1);
            end.setDate(1);
            break;
    }

    timeline.setWindow(start, end);
}

// Calculate maximum concurrent tasks
function calculatePeakConcurrency(items) {
    const events = [];

    // Create start/end events
    items.forEach(item => {
        events.push({ time: new Date(item.start), type: 'start' });
        events.push({ time: new Date(item.end), type: 'end' });
    });

    // Sort by time
    events.sort((a, b) => a.time - b.time);

    let current = 0;
    let max = 0;

    events.forEach(event => {
        if (event.type === 'start') {
            current++;
            max = Math.max(max, current);
        } else {
            current--;
        }
    });

    return max;
}

// Update product filter dropdown
function updateTimelineProductFilter() {
    const productSelect = document.getElementById('timelineProductSelect');
    if (!productSelect || !scenarioData?.products) return;

    const currentValue = productSelect.value;
    productSelect.innerHTML = '<option value="all">All Products</option>';

    scenarioData.products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.name;
        option.textContent = product.name;
        productSelect.appendChild(option);
    });

    // Restore selection
    if ([...productSelect.options].some(opt => opt.value === currentValue)) {
        productSelect.value = currentValue;
    }
}

// Show task details popup
function showTaskDetails(item) {
    const task = item.taskData;
    if (!task) return;

    const details = `
Task: ${task.taskId}
Type: ${item.type}
Product: ${task.product}
Team: ${task.team}
Duration: ${item.duration} minutes
Start: ${new Date(item.start).toLocaleString()}
End: ${new Date(item.end).toLocaleString()}
Priority: ${task.priority || 'N/A'}
Dependencies: ${task.dependencies?.length || 0}
${task.isCritical ? 'CRITICAL TASK' : ''}
    `;

    alert(details);
}

// Refresh timeline
function refreshTimeline() {
    renderTimeline();
    showNotification('Timeline refreshed', 'success');
}

// Export timeline data
function exportTimelineData() {
    if (currentTimelineData.length === 0) {
        alert('No timeline data to export');
        return;
    }

    const productFilter = document.getElementById('timelineProductSelect')?.value || 'all';
    const teamFilter = document.getElementById('timelineTeamSelect')?.value || 'all';
    const groupBy = document.getElementById('timelineGroupBy')?.value || 'team';

    let csvContent = "High-Granularity Production Timeline Export\n";
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += `Scenario: ${currentScenario}\n`;
    csvContent += `Filters: Product=${productFilter}, Team=${teamFilter}, GroupBy=${groupBy}\n\n`;

    csvContent += "Task ID,Type,Product,Team,Group,Priority,Start Time,End Time,Duration (min),Critical,Dependencies\n";

    currentTimelineData
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .forEach(item => {
            const task = item.taskData;
            const startTime = new Date(item.start).toLocaleString();
            const endTime = new Date(item.end).toLocaleString();
            const isCritical = task.isCritical ? 'Yes' : 'No';
            const dependencies = task.dependencies?.length || 0;

            csvContent += `"${item.id}","${item.type}","${task.product}","${task.team}","${item.group}","${item.priority}","${startTime}","${endTime}","${item.duration}","${isCritical}","${dependencies}"\n`;
        });

    // Add statistics
    csvContent += "\nTimeline Statistics:\n";
    csvContent += `Total Tasks: ${currentTimelineData.length}\n`;
    csvContent += `Groups: ${currentTimelineGroups.length}\n`;
    csvContent += `Peak Concurrency: ${document.getElementById('timelinePeakConcurrency').textContent}\n`;
    csvContent += `Time Span: ${document.getElementById('timelineSpan').textContent}\n`;

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `timeline_${currentScenario}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Timeline data exported successfully!', 'success');
}

// Replace the old Gantt functions - these are for backward compatibility
function setupGanttProductFilter() {
    updateTimelineProductFilter();
}

function setupGanttTeamFilter() {
    // Timeline team filter is handled in HTML
}



// Enhanced getGanttTasks function with role aggregation support
function getGanttTasks(productFilter = 'all', teamFilter = 'all') {
    if (!scenarioData || !scenarioData.tasks) return [];

    return scenarioData.tasks
        .filter(task => {
            // Product filter
            if (productFilter !== 'all' && task.product !== productFilter) {
                return false;
            }

            // Team filter with role aggregation
            if (teamFilter === 'all') {
                return true;
            } else if (teamFilter === 'all-mechanics') {
                return task.team && task.team.toLowerCase().includes('mechanic');
            } else if (teamFilter === 'all-quality') {
                return task.team && task.team.toLowerCase().includes('quality');
            } else if (teamFilter === 'all-customer') {
                return task.team && task.team.toLowerCase().includes('customer');
            } else {
                return task.team === teamFilter;
            }
        })
        .map(task => ({
            id: task.taskId,
            name: `${task.team} - Task ${task.taskId} - ${task.type}`,
            start: task.startTime,
            end: task.endTime,
            progress: 100,
            custom_class: getGanttColor(task.product, task.isCriticalPath),
            dependencies: (task.dependencies || []).map(d =>
                typeof d === 'object' ? (d.taskId || d.id || d.task) : d
            ).join(','),
            // Additional properties for sorting
            product: task.product,
            team: task.team,
            type: task.type,
            priority: task.priority || 999,
            duration: task.duration || 0
        }));
}

let gantt;
// Enhanced render function with view mode support
function renderGanttChart() {
    // Add null checks for DOM elements
    const ganttProductSelect = document.getElementById('ganttProductSelect');
    const ganttTeamSelect = document.getElementById('ganttTeamSelect');
    const ganttSortSelect = document.getElementById('ganttSortSelect');

    const productFilter = ganttProductSelect ? ganttProductSelect.value || 'all' : 'all';
    const teamFilter = ganttTeamSelect ? ganttTeamSelect.value || 'all' : 'all';
    const sortBy = ganttSortSelect ? ganttSortSelect.value || 'start' : 'start';

    let tasks = getGanttTasks(productFilter, teamFilter);

    if (tasks.length === 0) {
        const ganttDiv = document.getElementById('ganttChart');
        if (ganttDiv) {
            ganttDiv.innerHTML = '<div style="color: #ef4444; padding: 40px; text-align: center;">No tasks to display for the selected filters.</div>';
        }
        return;
    }

    // Apply sorting with null checks
    switch(sortBy) {
        case 'start':
            tasks.sort((a, b) => new Date(a.start) - new Date(b.start));
            break;
        case 'product':
            tasks.sort((a, b) => {
                const productA = a.product || '';
                const productB = b.product || '';
                if (productA !== productB) {
                    return productA.localeCompare(productB);
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        case 'priority':
            tasks.sort((a, b) => {
                const priorityA = a.priority || 999;
                const priorityB = b.priority || 999;
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        case 'team':
            tasks.sort((a, b) => {
                const teamA = a.team || '';
                const teamB = b.team || '';
                if (teamA !== teamB) {
                    return teamA.localeCompare(teamB);
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        case 'duration':
            tasks.sort((a, b) => {
                const durA = a.duration || 0;
                const durB = b.duration || 0;
                if (durA !== durB) {
                    return durB - durA;
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
    }

    renderGanttChartWithTasks(tasks);
}

// Fix 3: Enhanced renderGanttChartWithTasks with better error handling

function renderGanttChartWithTasks(tasks) {
    const ganttDiv = document.getElementById('ganttChart');
    if (!ganttDiv) {
        console.error('Gantt chart container not found');
        return;
    }

    const ganttViewModeSelect = document.getElementById('ganttViewMode');
    const ganttSortSelect = document.getElementById('ganttSortSelect');

    const viewMode = ganttViewModeSelect ? ganttViewModeSelect.value || 'Day' : 'Day';
    const sortBy = ganttSortSelect ? ganttSortSelect.value || 'start' : 'start';

    // Clear the gantt chart
    ganttDiv.innerHTML = '';

    // Remove any existing info divs
    const existingInfoDivs = ganttDiv.parentNode ? ganttDiv.parentNode.querySelectorAll('.gantt-info-div') : [];
    existingInfoDivs.forEach(div => div.remove());

    if (tasks.length === 0) {
        ganttDiv.innerHTML = '<div style="color: #ef4444; padding: 40px; text-align: center;">No tasks to display.</div>';
        return;
    }

    try {
        // Validate tasks data before creating Gantt
        const validatedTasks = tasks.map(task => ({
            id: task.id || `task_${Math.random().toString(36).substr(2, 9)}`,
            name: task.name || `Task ${task.id}`,
            start: task.start,
            end: task.end,
            progress: task.progress || 0,
            custom_class: task.custom_class || '',
            dependencies: task.dependencies || '',
            product: task.product || 'Unknown',
            team: task.team || 'Unknown',
            type: task.type || 'Production',
            priority: task.priority || 999,
            duration: task.duration || 0
        }));

        // Create new Gantt chart with error handling
        if (typeof Gantt !== 'undefined') {
            window.gantt = new Gantt(ganttDiv, validatedTasks, {
                header_height: 50,
                column_width: viewMode === 'Hour' ? 60 : viewMode === 'Day' ? 30 : viewMode === 'Week' ? 140 : 300,
                step: viewMode === 'Hour' ? 24 : undefined,
                view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
                bar_height: 20,
                bar_corner_radius: 3,
                arrow_curve: 5,
                padding: 18,
                view_mode: viewMode,
                date_format: 'YYYY-MM-DD',
                custom_popup_html: function(task) {
                    const start_date = new Date(task.start);
                    const end_date = new Date(task.end);
                    const duration = Math.ceil((end_date - start_date) / (1000 * 60 * 60 * 24));

                    return `
                        <div class="details-container">
                            <h5>${task.name || 'Unnamed Task'}</h5>
                            <p><strong>Product:</strong> ${task.product || 'N/A'}</p>
                            <p><strong>Team:</strong> ${task.team || 'N/A'}</p>
                            <p><strong>Type:</strong> ${task.type || 'N/A'}</p>
                            <p><strong>Duration:</strong> ${duration} day${duration !== 1 ? 's' : ''}</p>
                            <p><strong>Start:</strong> ${start_date.toLocaleDateString()}</p>
                            <p><strong>End:</strong> ${end_date.toLocaleDateString()}</p>
                            ${task.priority ? `<p><strong>Priority:</strong> ${task.priority}</p>` : ''}
                        </div>
                    `;
                }
            });

            // Add task count info
            if (ganttDiv.parentNode) {
                const infoDiv = document.createElement('div');
                infoDiv.className = 'gantt-info-div';
                infoDiv.style.cssText = 'padding: 10px; background: #f3f4f6; border-radius: 6px; margin-bottom: 10px; font-size: 14px; color: #374151;';
                infoDiv.innerHTML = `Showing ${validatedTasks.length} tasks - View: ${viewMode} - Sorted by: ${sortBy}`;
                ganttDiv.parentNode.insertBefore(infoDiv, ganttDiv);
            }

        } else {
            ganttDiv.innerHTML = `
                <div style="color: #ef4444; padding: 40px; text-align: center;">
                    <h3>Gantt Library Not Loaded</h3>
                    <p>The Frappe Gantt library is not available. Please check if it's properly included in your HTML.</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error creating Gantt chart:', error);
        ganttDiv.innerHTML = `
            <div style="color: #ef4444; padding: 40px; text-align: center;">
                <h3>Error Loading Gantt Chart</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="renderGanttChart()">Retry</button>
            </div>
        `;
    }
}

// Fix 4: Add initialization check for timeline

function initializeTimeline() {
    console.log('Starting timeline initialization...');

    timelineContainer = document.getElementById('timelineVisualization');
    if (!timelineContainer) {
        console.error('Timeline container not found');
        return;
    }

    if (typeof vis === 'undefined') {
        console.error('vis.js library not loaded');
        timelineContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <h3>Timeline Library Missing</h3>
                <p>The vis.js library is not loaded. Please check your HTML includes.</p>
                <p>Add this to your HTML head: <code>&lt;script src="https://unpkg.com/vis-timeline@7.7.3/standalone/umd/vis-timeline-graph2d.min.js"&gt;&lt;/script&gt;</code></p>
            </div>
        `;
        return;
    }

    // Clear any existing timeline
    if (timeline) {
        try {
            timeline.destroy();
        } catch (e) {
            console.warn('Error destroying existing timeline:', e);
        }
        timeline = null;
    }

    // Get current time scale setting
    const timeScaleSelect = document.getElementById('timelineScale');
    const timeScale = timeScaleSelect ? timeScaleSelect.value || '1day' : '1day';
    const timelineOptions = getTimelineOptions(timeScale);

    try {
        timeline = new vis.Timeline(timelineContainer, [], [], timelineOptions);
        console.log(`Timeline created successfully with ${timeScale} scale`);

        setupTimelineEventListeners();

        // Set initial focus date to now
        const focusDateInput = document.getElementById('timelineFocusDate');
        if (focusDateInput && !focusDateInput.value) {
            focusDateInput.value = new Date().toISOString().slice(0, 16);
        }

        renderTimeline();

    } catch (error) {
        console.error('Error creating timeline:', error);
        timelineContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <h3>Timeline Creation Error</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Refresh Page</button>
            </div>
        `;
    }
}

// Setup enhanced team filter with role aggregation
function setupGanttTeamFilter() {
    const select = document.getElementById('ganttTeamSelect');
    if (!select) return;

    select.innerHTML = '';

    // Add aggregation options first
    select.innerHTML = `
        <option value="all">All Teams</option>
        <option value="all-mechanics">All Mechanic Teams</option>
        <option value="all-quality">All Quality Teams</option>
        <option value="all-customer">All Customer Teams</option>
    `;

    if (scenarioData.tasks) {
        // Get unique teams and organize by type
        const mechanicTeams = new Set();
        const qualityTeams = new Set();
        const customerTeams = new Set();
        const otherTeams = new Set();

        scenarioData.tasks.forEach(task => {
            const team = task.team;
            if (team) {
                if (team.toLowerCase().includes('customer')) {
                    customerTeams.add(team);
                } else if (team.toLowerCase().includes('quality')) {
                    qualityTeams.add(team);
                } else if (team.toLowerCase().includes('mechanic')) {
                    mechanicTeams.add(team);
                } else {
                    otherTeams.add(team);
                }
            }
        });

        // Add team groups
        if (mechanicTeams.size > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Mechanic Teams';
            Array.from(mechanicTeams).sort().forEach(team => {
                const option = document.createElement('option');
                option.value = team;
                option.textContent = team;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }

        if (qualityTeams.size > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Quality Teams';
            Array.from(qualityTeams).sort().forEach(team => {
                const option = document.createElement('option');
                option.value = team;
                option.textContent = team;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }

        if (customerTeams.size > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Customer Teams';
            Array.from(customerTeams).sort().forEach(team => {
                const option = document.createElement('option');
                option.value = team;
                option.textContent = team;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }

        if (otherTeams.size > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = 'Other Teams';
            Array.from(otherTeams).sort().forEach(team => {
                const option = document.createElement('option');
                option.value = team;
                option.textContent = team;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }
    }

    select.onchange = renderGanttChart;
}

// Loading and error states
function showLoading(message = 'Loading...') {
    const content = document.querySelector('.main-content');
    if (content) {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingIndicator';
        loadingDiv.className = 'loading';
        loadingDiv.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner"></div>
                <div style="margin-top: 20px;">${message}</div>
            </div>
        `;
        content.appendChild(loadingDiv);
    }
}

function hideLoading() {
    const loadingDiv = document.getElementById('loadingIndicator');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function showError(message) {
    const content = document.querySelector('.main-content');
    if (content) {
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <h2>Error</h2>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 20px;">
                    Reload Page
                </button>
            </div>
        `;
    }
}

function formatDateTime(date) {
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Auto-assign function with capacity limits and persistent storage
// Auto-assign function with proper skill-based nomenclature
async function autoAssign() {
    // Get visible tasks from the table (these are already filtered)
    const taskRows = document.querySelectorAll('#taskTableBody tr');
    let successCount = 0;
    let conflictCount = 0;
    let partialCount = 0;

    // Initialize saved assignments for this scenario if not exists
    if (!savedAssignments[currentScenario]) {
        savedAssignments[currentScenario] = {};
    }

    // Build mechanic availability tracking based on current filter
    const mechanicAvailability = {};

    // Determine which teams to include based on current selection
    let teamsToInclude = [];
    if (selectedTeam === 'all') {
        teamsToInclude = Object.keys(scenarioData.teamCapacities || {});
    } else if (selectedTeam === 'all-mechanics') {
        teamsToInclude = Object.keys(scenarioData.teamCapacities || {})
            .filter(t => t.toLowerCase().includes('mechanic') && !t.toLowerCase().includes('quality') && !t.toLowerCase().includes('customer'));
    } else if (selectedTeam === 'all-quality') {
        teamsToInclude = Object.keys(scenarioData.teamCapacities || {})
            .filter(t => t.toLowerCase().includes('quality'));
    } else if (selectedTeam === 'all-customer') {
        teamsToInclude = Object.keys(scenarioData.teamCapacities || {})
            .filter(t => t.toLowerCase().includes('customer'));
    } else {
        // For specific team selection, include all skill variations
        teamsToInclude = Object.keys(scenarioData.teamCapacities || {})
            .filter(t => {
                const baseTeam = t.split(' (')[0];
                return baseTeam === selectedTeam || t === selectedTeam;
            });
    }

    // Apply skill filter if not 'all'
    if (selectedSkill !== 'all') {
        teamsToInclude = teamsToInclude.filter(teamSkill => {
            const skillMatch = teamSkill.match(/\((.+?)\)/);
            return !skillMatch || skillMatch[1] === selectedSkill;
        });
    }

    // Create mechanics/inspectors/customers for each team-skill combination
    teamsToInclude.forEach(teamSkill => {
        const capacity = (scenarioData.teamCapacities && scenarioData.teamCapacities[teamSkill]) || 0;

        // Parse team and skill from the teamSkill string
        const skillMatch = teamSkill.match(/^(.+?)\s*\((.+?)\)\s*$/);
        let baseTeam, skill;

        if (skillMatch) {
            baseTeam = skillMatch[1].trim();
            skill = skillMatch[2].trim();
        } else {
            baseTeam = teamSkill;
            skill = null;
        }

        const isQuality = baseTeam.toLowerCase().includes('quality');
        const isCustomer = baseTeam.toLowerCase().includes('customer');

        for (let i = 1; i <= capacity; i++) {
            // Use the full team-skill identifier as the mechanic ID base
            const mechId = `${teamSkill}_${i}`;

            // Create display name with appropriate role
            let displayName;
            if (isCustomer) {
                displayName = `Customer #${i} - ${baseTeam}`;
            } else if (isQuality) {
                displayName = `Inspector #${i} - ${baseTeam}`;
            } else {
                displayName = `Mechanic #${i} - ${baseTeam}`;
            }
            if (skill) {
                displayName += ` (${skill})`;
            }

            mechanicAvailability[mechId] = {
                id: mechId,
                teamSkill: teamSkill,  // Full team-skill identifier
                baseTeam: baseTeam,    // Base team name
                skill: skill,           // Skill code
                displayName: displayName,
                busyUntil: null,
                assignedTasks: [],
                isQuality: isQuality,
                isCustomer: isCustomer,
                teamPosition: i
            };
        }
    });

    console.log(`Created ${Object.keys(mechanicAvailability).length} workers with skills:`,
                Object.values(mechanicAvailability).slice(0, 3).map(m => m.displayName));

    // Process each visible task row
    taskRows.forEach(row => {
        const taskId = row.querySelector('.task-id')?.textContent?.replace(/[📦🔧⚡👤]/g, '').trim();
        if (!taskId) return;

        // Find the task data
        const task = scenarioData.tasks.find(t => t.taskId === taskId);
        if (!task) {
            console.warn(`Task ${taskId} not found in scenario data`);
            return;
        }

        const mechanicsNeeded = task.mechanics || 1;
        const taskStart = new Date(task.startTime);
        const taskEnd = new Date(task.endTime);

        // Get the task's team-skill requirement
        const taskTeamSkill = task.teamSkill || task.team;
        const taskSkill = task.skill;

        // Check if this is a customer task
        const isCustomerTask = task.isCustomerTask ||
                              task.type === 'Customer' ||
                              task.taskId.includes('CC_');

        // Find available mechanics that match the task's team-skill requirement
        const availableMechanics = [];
        for (const [mechId, mech] of Object.entries(mechanicAvailability)) {
            // Check if mechanic matches task's team-skill requirement
            let matches = false;

            if (isCustomerTask) {
                // Customer tasks need customer team members
                matches = mech.isCustomer;
            } else if (task.isQualityTask || task.type === 'Quality Inspection') {
                // Quality tasks need quality team members
                matches = mech.isQuality;
            } else if (mech.teamSkill === taskTeamSkill) {
                // Exact team-skill match
                matches = true;
            } else if (!task.skill && mech.baseTeam === task.team) {
                // Task doesn't require specific skill, base team matches
                matches = true;
            } else if (task.team === mech.baseTeam && (!taskSkill || taskSkill === mech.skill)) {
                // Base team matches and skill matches (or no skill required)
                matches = true;
            }

            if (matches) {
                // Check if mechanic is available
                if (!mech.busyUntil || mech.busyUntil <= taskStart) {
                    availableMechanics.push(mech);
                    if (availableMechanics.length >= mechanicsNeeded) break;
                }
            }
        }

        // Sort available mechanics by skill match priority
        availableMechanics.sort((a, b) => {
            // Prefer exact skill match
            if (taskSkill) {
                const aMatch = a.skill === taskSkill ? 0 : 1;
                const bMatch = b.skill === taskSkill ? 0 : 1;
                if (aMatch !== bMatch) return aMatch - bMatch;
            }
            // Then by team position
            return a.teamPosition - b.teamPosition;
        });

        // Assign mechanics to task
        const assignedMechanics = [];

        if (availableMechanics.length >= mechanicsNeeded) {
            // Full assignment possible
            for (let i = 0; i < mechanicsNeeded; i++) {
                const mech = availableMechanics[i];
                mech.busyUntil = taskEnd;
                mech.assignedTasks.push({
                    taskId: taskId,
                    startTime: task.startTime,
                    endTime: task.endTime,
                    type: task.type,
                    product: task.product,
                    duration: task.duration,
                    team: task.team,
                    teamSkill: taskTeamSkill,
                    skill: taskSkill,
                    isCustomerTask: isCustomerTask
                });
                assignedMechanics.push(mech.id);

                // Update the dropdown
                const selectElement = row.querySelector(`.assign-select[data-task-id="${taskId}"][data-position="${i}"]`) ||
                                    row.querySelector(`.assign-select[data-task-id="${taskId}"]`);
                if (selectElement) {
                    selectElement.value = mech.id;
                    selectElement.style.backgroundColor = '#d4edda';
                    setTimeout(() => {
                        selectElement.style.backgroundColor = '';
                        selectElement.classList.add('has-saved-assignment');
                    }, 2000);
                }
            }

            // Save the assignment
            savedAssignments[currentScenario][taskId] = {
                mechanics: assignedMechanics,
                team: task.team,
                teamSkill: taskTeamSkill,
                skill: taskSkill,
                mechanicsNeeded: mechanicsNeeded,
                isCustomerTask: isCustomerTask
            };

            successCount++;
            row.style.backgroundColor = '#f0fdf4';
        } else if (availableMechanics.length > 0) {
            // Partial assignment
            for (let i = 0; i < availableMechanics.length; i++) {
                const mech = availableMechanics[i];
                mech.busyUntil = taskEnd;
                mech.assignedTasks.push({
                    taskId: taskId,
                    startTime: task.startTime,
                    endTime: task.endTime,
                    type: task.type,
                    product: task.product,
                    duration: task.duration,
                    team: task.team,
                    teamSkill: taskTeamSkill,
                    skill: taskSkill,
                    isCustomerTask: isCustomerTask
                });
                assignedMechanics.push(mech.id);

                const selectElement = row.querySelector(`.assign-select[data-task-id="${taskId}"][data-position="${i}"]`);
                if (selectElement) {
                    selectElement.value = mech.id;
                    selectElement.style.backgroundColor = '#fff3cd';
                    setTimeout(() => {
                        selectElement.style.backgroundColor = '';
                        selectElement.classList.add('partial');
                    }, 2000);
                }
            }

            // Save partial assignment
            savedAssignments[currentScenario][taskId] = {
                mechanics: assignedMechanics,
                team: task.team,
                teamSkill: taskTeamSkill,
                skill: taskSkill,
                mechanicsNeeded: mechanicsNeeded,
                partial: true,
                isCustomerTask: isCustomerTask
            };

            partialCount++;
            row.style.backgroundColor = '#fffbeb';
        } else {
            // No mechanics available
            conflictCount++;
            row.style.backgroundColor = '#fef2f2';

            console.log(`No workers available for task ${taskId}:`,
                       `Team: ${task.team}, TeamSkill: ${taskTeamSkill}, Skill: ${taskSkill}`,
                       `IsCustomer: ${isCustomerTask}`);
        }

        // Clear row color after a delay
        setTimeout(() => {
            row.style.backgroundColor = '';
        }, 3000);
    });

    // Store assignments for the Individual view
    if (!savedAssignments[currentScenario].mechanicSchedules) {
        savedAssignments[currentScenario].mechanicSchedules = {};
    }

    // Build mechanic schedules for Individual view
    for (const [mechId, mech] of Object.entries(mechanicAvailability)) {
        if (mech.assignedTasks.length > 0) {
            savedAssignments[currentScenario].mechanicSchedules[mechId] = {
                mechanicId: mechId,
                displayName: mech.displayName,
                team: mech.baseTeam,
                teamSkill: mech.teamSkill,
                skill: mech.skill,
                isCustomer: mech.isCustomer,
                isQuality: mech.isQuality,
                tasks: mech.assignedTasks.sort((a, b) =>
                    new Date(a.startTime) - new Date(b.startTime)
                )
            };
        }
    }

    // Update assignment summary
    if (typeof updateAssignmentSummary === 'function') {
        updateAssignmentSummary();
    }

    // Show results with skill information
    const totalWorkers = Object.keys(mechanicAvailability).length;
    const roleBreakdown = {};
    Object.values(mechanicAvailability).forEach(mech => {
        let role;
        if (mech.isCustomer) role = 'Customer';
        else if (mech.isQuality) role = 'Quality Inspector';
        else role = 'Mechanic';

        roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
    });

    let roleInfo = Object.entries(roleBreakdown)
        .map(([role, count]) => `${role}: ${count}`)
        .join(', ');

    alert(`Auto-Assignment Complete!\n\n` +
          `Fully Assigned: ${successCount}\n` +
          `Partially Assigned: ${partialCount}\n` +
          `Conflicts: ${conflictCount}\n\n` +
          `Total Tasks: ${taskRows.length}\n` +
          `Available Workforce: ${totalWorkers}\n` +
          `Roles: ${roleInfo}\n\n` +
          `Assignments have been saved and will persist across filter changes.`);

    console.log('Saved assignments with customer tracking:', savedAssignments[currentScenario]);
}

// Load saved assignments into the table
function loadSavedAssignments() {
    if (!savedAssignments[currentScenario]) return;

    const assignments = savedAssignments[currentScenario];
    const taskRows = document.querySelectorAll('#taskTableBody tr');
    let loadedCount = 0;

    taskRows.forEach(row => {
        const taskId = row.querySelector('.task-id')?.textContent?.replace(/[🔦🔧⚡]/g, '').trim();
        if (!taskId || !assignments[taskId]) return;

        const taskAssignment = assignments[taskId];
        const selectElements = row.querySelectorAll('.assign-select');

        // Restore assignments to dropdowns
        taskAssignment.mechanics.forEach((mechId, index) => {
            if (selectElements[index]) {
                // Check if this mechanic option exists in the dropdown
                const optionExists = Array.from(selectElements[index].options)
                    .some(opt => opt.value === mechId);

                if (optionExists) {
                    selectElements[index].value = mechId;
                    selectElements[index].classList.add('has-saved-assignment');
                    loadedCount++;
                }
            }
        });
    });

    // Update summary
    if (typeof updateAssignmentSummary === 'function') {
        updateAssignmentSummary();
    }

    if (loadedCount > 0) {
        console.log(`Loaded ${loadedCount} saved assignments for ${currentScenario}`);
    }
}

// Save assignments to localStorage for persistence across sessions
function saveAssignmentsToStorage() {
    try {
        localStorage.setItem(`assignments_${currentScenario}`, JSON.stringify(savedAssignments[currentScenario]));
        alert('Assignments saved successfully!');
    } catch (e) {
        console.error('Failed to save assignments:', e);
        alert('Failed to save assignments to browser storage.');
    }
}

// Load assignments from localStorage
function loadAssignmentsFromStorage() {
    try {
        const stored = localStorage.getItem(`assignments_${currentScenario}`);
        if (stored) {
            savedAssignments[currentScenario] = JSON.parse(stored);
            loadSavedAssignments();
            alert('Previous assignments loaded successfully!');
        } else {
            alert('No saved assignments found for this scenario.');
        }
    } catch (e) {
        console.error('Failed to load assignments:', e);
        alert('Failed to load assignments from browser storage.');
    }
}

// Clear all saved assignments
function clearSavedAssignments() {
    if (confirm('This will clear all saved assignments for this scenario. Continue?')) {
        savedAssignments[currentScenario] = {};
        localStorage.removeItem(`assignments_${currentScenario}`);

        // Clear all dropdowns
        document.querySelectorAll('.assign-select').forEach(select => {
            select.value = '';
            select.classList.remove('has-saved-assignment');
        });

        alert('Saved assignments cleared.');

        if (typeof updateAssignmentSummary === 'function') {
            updateAssignmentSummary();
        }
    }
}

// Export tasks function
async function exportTasks() {
    try {
        // Export to CSV including assignments
        const tasks = scenarioData.tasks || [];
        const assignments = savedAssignments[currentScenario] || {};

        // Build CSV data
        let csvContent = "Task ID,Type,Product,Team,Start Time,End Time,Duration,Mechanics Needed,Assigned Mechanics\n";

        tasks.forEach(task => {
            const assignment = assignments[task.taskId];
            const assignedMechanics = assignment ? assignment.mechanics.join('; ') : 'Unassigned';

            csvContent += `"${task.taskId}","${task.type}","${task.product}","${task.team}",`;
            csvContent += `"${task.startTime}","${task.endTime}","${task.duration}","${task.mechanics || 1}",`;
            csvContent += `"${assignedMechanics}"\n`;
        });

        // Download the CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `assignments_${currentScenario}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (typeof showNotification === 'function') {
            showNotification('Assignments exported successfully!', 'success');
        } else {
            alert('Assignments exported successfully!');
        }
    } catch (error) {
        console.error('Export failed:', error);
        // Fallback to server export
        window.location.href = `/api/export/${currentScenario}`;
    }
}

// Main Supply Chain View update function
async function updateSupplyChainView() {
    console.log('Updating Supply Chain View...');

    // Collect late parts data from all scenarios
    collectLatePartsData();

    // Calculate metrics
    calculateSupplyChainMetrics();

    // Update UI components
    updateSupplyChainMetrics();
    updateLatePartsTimeline();
    updateLatePartsImpactTable();
    updateProductImpactGrid();
    updateRiskMatrix();

    // Setup filters
    setupSupplyChainFilters();
}

// Collect late parts data from all scenarios
function collectLatePartsData() {
    latePartsData = {
        baseline: [],
        scenario1: [],
        scenario2: [],
        scenario3: []
    };

    // Process each scenario
    Object.keys(allScenarios).forEach(scenarioId => {
        const scenario = allScenarios[scenarioId];
        if (scenario && scenario.tasks) {
            console.log(`Processing ${scenarioId}: ${scenario.tasks.length} tasks`);

            const lateParts = scenario.tasks.filter(task => {
                // More comprehensive late part detection
                return task.isLatePartTask === true ||
                       task.type === 'Late Part' ||
                       (task.taskId && (
                           task.taskId.includes('LP_') ||
                           task.taskId.includes('Late') ||
                           task.taskId.startsWith('LP') ||
                           task.taskId.includes('_LP_')
                       )) ||
                       // Also check task description/name if available
                       (task.name && task.name.toLowerCase().includes('late part'));
            });

            console.log(`Found ${lateParts.length} late parts in ${scenarioId}`);

            // Log first few for debugging
            if (lateParts.length > 0) {
                console.log('Sample late parts:', lateParts.slice(0, 3).map(lp => ({
                    taskId: lp.taskId,
                    type: lp.type,
                    product: lp.product
                })));
            }

            latePartsData[scenarioId] = lateParts.map(task => ({
                ...task,
                scenario: scenarioId,
                startDate: new Date(task.startTime),
                endDate: new Date(task.endTime),
                dayOfSchedule: Math.floor((new Date(task.startTime) - getScheduleStartDate(scenario)) / (1000 * 60 * 60 * 24))
            }));
        }
    });

    console.log('Late parts collected:', Object.keys(latePartsData).map(s => `${s}: ${latePartsData[s].length}`));
}

// Calculate supply chain metrics vis scenario comparisons
function calculateSupplyChainMetrics() {
    supplyChainMetrics = {
        totalLateParts: 0,
        affectedProducts: new Set(),
        criticalLateParts: 0,
        avgDelayImpact: 0,
        relativeDelayImpact: 0,
        referenceScenario: currentScenario,  // Use main dropdown scenario as reference
        comparisonScenario: getSelectedComparisonScenario(),
        byProduct: {},
        byScenario: {}
    };

    // Process each scenario's late parts
    Object.entries(latePartsData).forEach(([scenarioId, lateParts]) => {
        supplyChainMetrics.byScenario[scenarioId] = {
            count: lateParts.length,
            products: new Set(),
            critical: 0,
            earliestDay: 999,
            latestDay: 0
        };

        lateParts.forEach(part => {
            // Update global metrics
            supplyChainMetrics.totalLateParts++;
            supplyChainMetrics.affectedProducts.add(part.product);

            if (part.isCritical || part.slackHours < 24) {
                supplyChainMetrics.criticalLateParts++;
                supplyChainMetrics.byScenario[scenarioId].critical++;
            }

            // Update product metrics
            if (!supplyChainMetrics.byProduct[part.product]) {
                supplyChainMetrics.byProduct[part.product] = {
                    totalParts: 0,
                    criticalParts: 0,
                    scenarios: {}
                };
            }

            supplyChainMetrics.byProduct[part.product].totalParts++;
            if (part.isCritical) {
                supplyChainMetrics.byProduct[part.product].criticalParts++;
            }

            // Track per-scenario product data
            if (!supplyChainMetrics.byProduct[part.product].scenarios[scenarioId]) {
                supplyChainMetrics.byProduct[part.product].scenarios[scenarioId] = {
                    count: 0,
                    scheduleDays: []
                };
            }

            supplyChainMetrics.byProduct[part.product].scenarios[scenarioId].count++;
            supplyChainMetrics.byProduct[part.product].scenarios[scenarioId].scheduleDays.push(part.dayOfSchedule);

            // Update scenario metrics
            supplyChainMetrics.byScenario[scenarioId].products.add(part.product);
            supplyChainMetrics.byScenario[scenarioId].earliestDay = Math.min(
                supplyChainMetrics.byScenario[scenarioId].earliestDay,
                part.dayOfSchedule
            );
            supplyChainMetrics.byScenario[scenarioId].latestDay = Math.max(
                supplyChainMetrics.byScenario[scenarioId].latestDay,
                part.dayOfSchedule
            );
        });
    });

    // Calculate relative delay impact: comparison_scenario - reference_scenario
    const referenceScenario = allScenarios[supplyChainMetrics.referenceScenario];
    const comparisonScenario = allScenarios[supplyChainMetrics.comparisonScenario];
    const relativeImpacts = [];

    if (referenceScenario && comparisonScenario &&
        referenceScenario.products && comparisonScenario.products &&
        supplyChainMetrics.referenceScenario !== supplyChainMetrics.comparisonScenario) {

        // Create reference product map
        const referenceProducts = {};
        referenceScenario.products.forEach(product => {
            referenceProducts[product.name] = product.latenessDays;
        });

        // Calculate relative impacts for each product
        comparisonScenario.products.forEach(product => {
            const referenceLateness = referenceProducts[product.name] || 0;
            const comparisonLateness = product.latenessDays;
            const relativeDifference = comparisonLateness - referenceLateness;
            relativeImpacts.push(relativeDifference);
        });
    }

    supplyChainMetrics.relativeDelayImpact = relativeImpacts.length > 0 ?
        (relativeImpacts.reduce((a, b) => a + b, 0) / relativeImpacts.length).toFixed(1) : 0;

    // Also keep absolute calculation for fallback
    const absoluteImpacts = [];
    Object.values(allScenarios).forEach(scenario => {
        if (scenario.products) {
            scenario.products.forEach(product => {
                if (product.latenessDays > 0) {
                    absoluteImpacts.push(product.latenessDays);
                }
            });
        }
    });

    supplyChainMetrics.avgDelayImpact = absoluteImpacts.length > 0 ?
        (absoluteImpacts.reduce((a, b) => a + b, 0) / absoluteImpacts.length).toFixed(1) : 0;
}

// Update metric cards
function updateSupplyChainMetrics() {
    // Get the current selected scenario's late parts count
    const currentScenarioLateParts = latePartsData[currentScenario] || [];

    // Count unique late parts across all scenarios (for comparison)
    const allLateParts = new Set();
    const allProducts = new Set();
    let totalCritical = 0;

    Object.values(latePartsData).forEach(parts => {
        parts.forEach(part => {
            // Use full task ID for uniqueness, not split
            allLateParts.add(part.taskId);
            allProducts.add(part.product);

            if (part.isCritical || part.slackHours < 24) {
                totalCritical++;
            }
        });
    });

    // Update metrics to show current scenario's data
    document.getElementById('totalLateParts').textContent = currentScenarioLateParts.length;
    document.getElementById('affectedProducts').textContent =
        new Set(currentScenarioLateParts.map(p => p.product)).size;
    document.getElementById('criticalLateParts').textContent =
        currentScenarioLateParts.filter(p => p.isCritical || p.slackHours < 24).length;

    // Calculate average delay impact for current scenario
    // FIX: Don't redeclare currentScenario - use currentScenarioData instead
    const currentScenarioData = allScenarios[currentScenario];
    if (currentScenarioData && currentScenarioData.products) {
        const delays = currentScenarioData.products
            .filter(p => p.latenessDays > 0)
            .map(p => p.latenessDays);

        const avgDelay = delays.length > 0 ?
            (delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(1) : 0;

        document.getElementById('avgDelayImpact').textContent = avgDelay;
    } else {
        document.getElementById('avgDelayImpact').textContent = '0';
    }

    console.log(`Metrics updated - Late parts: ${currentScenarioLateParts.length}, Products affected: ${new Set(currentScenarioLateParts.map(p => p.product)).size}`);
}

// Update late parts timeline
function updateLatePartsTimeline() {
    const timeline = document.getElementById('latePartsTimeline');
    const selectedScenarios = getSelectedScenarios();
    const selectedProduct = document.getElementById('supplyChainProductFilter')?.value || 'all';

    let html = '';

    selectedScenarios.forEach(scenarioId => {
        let parts = latePartsData[scenarioId] || [];

        // Filter by product if selected
        if (selectedProduct !== 'all') {
            parts = parts.filter(p => p.product === selectedProduct);
        }

        // Sort by start time
        parts.sort((a, b) => a.startDate - b.startDate);

        const scenarioColor = getScenarioColor(scenarioId);

        html += `
            <div class="timeline-scenario ${scenarioId}">
                <h4>${scenarioId.toUpperCase()}: ${parts.length} Late Parts</h4>
                <div class="timeline-items">
        `;

        // Show first 10 late parts
        parts.slice(0, 10).forEach(part => {
            const critical = part.isCritical ? 'critical' : '';
            html += `
                <div class="timeline-late-part ${critical}">
                    <div style="min-width: 80px; font-weight: 600; color: ${scenarioColor};">
                        Day ${part.dayOfSchedule}
                    </div>
                    <div style="flex: 1;">
                        <strong>${part.taskId}</strong> - ${part.product}
                        ${part.team ? `(${part.team})` : ''}
                    </div>
                    <div style="min-width: 100px; text-align: right; font-size: 12px; color: #6b7280;">
                        ${formatDateTime(part.startDate)}
                    </div>
                    ${critical ? '<span style="color: #ef4444; font-size: 11px;">CRITICAL</span>' : ''}
                </div>
            `;
        });

        if (parts.length > 10) {
            html += `<div style="padding: 8px; color: #6b7280; font-size: 12px;">... and ${parts.length - 10} more</div>`;
        }

        html += `
                </div>
            </div>
        `;
    });

    timeline.innerHTML = html || '<div class="supply-chain-loading">No late parts data available</div>';
}

// Update impact table
function updateLatePartsImpactTable() {
    const tbody = document.getElementById('latePartsTableBody');
    const selectedProduct = document.getElementById('supplyChainProductFilter')?.value || 'all';

    // Group late parts by base task ID
    const latePartGroups = {};

    Object.entries(latePartsData).forEach(([scenarioId, parts]) => {
        parts.forEach(part => {
            const baseTaskId = part.taskId.split('_')[0]; // Remove instance suffix

            if (!latePartGroups[baseTaskId]) {
                latePartGroups[baseTaskId] = {
                    taskId: baseTaskId,
                    product: part.product,
                    type: part.type,
                    team: part.team,
                    scenarios: {}
                };
            }

            latePartGroups[baseTaskId].scenarios[scenarioId] = {
                startTime: part.startTime,
                endTime: part.endTime,
                dayOfSchedule: part.dayOfSchedule,
                isCritical: part.isCritical,
                slackHours: part.slackHours
            };
        });
    });

    // Filter by product
    let filteredGroups = Object.values(latePartGroups);
    if (selectedProduct !== 'all') {
        filteredGroups = filteredGroups.filter(g => g.product === selectedProduct);
    }

    // Build table rows
    let html = '';
    filteredGroups.slice(0, 50).forEach(group => {
        const criticalInAny = Object.values(group.scenarios).some(s => s.isCritical);
        const rowClass = criticalInAny ? 'highlight-late-part' : '';

        html += `<tr class="${rowClass}">`;
        html += `<td><strong>${group.taskId}</strong></td>`;
        html += `<td>${group.product}</td>`;
        html += `<td><span class="task-type late-part">${group.type || 'Late Part'}</span></td>`;
        html += `<td>${group.team || '-'}</td>`;

        // Add schedule cells for each scenario
        ['baseline', 'scenario1', 'scenario2', 'scenario3'].forEach(scenarioId => {
            if (group.scenarios[scenarioId]) {
                const sched = group.scenarios[scenarioId];
                const schedClass = sched.dayOfSchedule <= 5 ? 'schedule-early' :
                                  sched.dayOfSchedule <= 10 ? 'schedule-ontime' : 'schedule-late';
                html += `
                    <td class="schedule-cell ${schedClass}">
                        Day ${sched.dayOfSchedule}<br>
                        <small>${new Date(sched.startTime).toLocaleDateString()}</small>
                    </td>
                `;
            } else {
                html += `<td class="schedule-cell">-</td>`;
            }
        });

        // Critical path indicator
        html += `<td style="text-align: center;">`;
        if (criticalInAny) {
            html += `<span style="color: #ef4444;">✓</span>`;
        } else {
            html += `-`;
        }
        html += `</td>`;

        // Downstream impact
        const impactedTasks = calculateDownstreamImpact(group.taskId);
        html += `<td>${impactedTasks} tasks</td>`;

        html += `</tr>`;
    });

    tbody.innerHTML = html || '<tr><td colspan="10" style="text-align: center; color: #6b7280;">No late parts to display</td></tr>';
}

// Update product impact grid
function updateProductImpactGrid() {
    const grid = document.getElementById('productImpactGrid');
    const selectedScenarios = getSelectedScenarios();

    let html = '';

    Object.entries(supplyChainMetrics.byProduct).forEach(([product, metrics]) => {
        const latePartCount = Math.floor(metrics.totalParts / 4); // Average across scenarios

        html += `
            <div class="product-impact-card">
                <div class="product-impact-header">
                    <div class="product-impact-name">${product}</div>
                    <div class="late-part-count">${latePartCount} late parts</div>
                </div>

                <div style="font-size: 12px; color: #6b7280; margin: 5px 0;">
                    Critical parts: ${metrics.criticalParts > 0 ? Math.floor(metrics.criticalParts / 4) : 0}
                </div>

                <div class="impact-scenarios">
        `;

        selectedScenarios.forEach(scenarioId => {
            const scenario = allScenarios[scenarioId];
            if (scenario && scenario.products) {
                const productData = scenario.products.find(p => p.name === product);
                if (productData) {
                    const impactClass = productData.latenessDays > 0 ? 'late' :
                                       productData.latenessDays < 0 ? 'early' : 'ontime';
                    const impactText = productData.latenessDays > 0 ? `+${productData.latenessDays}d late` :
                                      productData.latenessDays < 0 ? `${Math.abs(productData.latenessDays)}d early` :
                                      'On time';

                    html += `
                        <div class="impact-scenario-row">
                            <span class="scenario-label">${scenarioId}:</span>
                            <span class="impact-days ${impactClass}">${impactText}</span>
                        </div>
                    `;
                }
            }
        });

        html += `
                </div>
            </div>
        `;
    });

    grid.innerHTML = html || '<div style="color: #6b7280;">No product impact data available</div>';
}

// Update risk matrix
function updateRiskMatrix() {
    const matrix = document.getElementById('riskMatrix');

    // Categorize late parts by risk level
    const riskCategories = {
        high: [],
        medium: [],
        low: []
    };

    Object.values(latePartsData).forEach(parts => {
        parts.forEach(part => {
            if (part.isCritical && part.dayOfSchedule > 10) {
                riskCategories.high.push(part);
            } else if (part.isCritical || part.dayOfSchedule > 15) {
                riskCategories.medium.push(part);
            } else {
                riskCategories.low.push(part);
            }
        });
    });

    let html = `
        <div class="risk-label">Risk Level</div>
        <div class="risk-cell risk-low">
            <strong>LOW</strong>
            <div class="risk-items">${Math.floor(riskCategories.low.length / 4)} items</div>
            <div style="font-size: 10px; margin-top: 5px;">Non-critical, early schedule</div>
        </div>
        <div class="risk-cell risk-medium">
            <strong>MEDIUM</strong>
            <div class="risk-items">${Math.floor(riskCategories.medium.length / 4)} items</div>
            <div style="font-size: 10px; margin-top: 5px;">Critical OR late schedule</div>
        </div>
        <div class="risk-cell risk-high">
            <strong>HIGH</strong>
            <div class="risk-items">${Math.floor(riskCategories.high.length / 4)} items</div>
            <div style="font-size: 10px; margin-top: 5px;">Critical AND late schedule</div>
        </div>
    `;

    matrix.innerHTML = html;
}

function getSelectedComparisonScenario() {
    const checkedRadio = document.querySelector('input[name="scenario-compare"]:checked');
    return checkedRadio ? checkedRadio.value : 'baseline';
}

// Helper functions
function getSelectedScenarios() {
    const checkboxes = document.querySelectorAll('.scenario-compare:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Add this function to debug what tasks exist
function debugTaskData() {
    console.log('=== DEBUGGING TASK DATA ===');

    Object.entries(allScenarios).forEach(([scenarioId, scenario]) => {
        if (scenario && scenario.tasks) {
            console.log(`\n${scenarioId.toUpperCase()}: ${scenario.tasks.length} total tasks`);

            // Count different task types
            const taskTypes = {};
            const latePartCandidates = [];

            scenario.tasks.forEach(task => {
                // Count by type
                const type = task.type || 'Unknown';
                taskTypes[type] = (taskTypes[type] || 0) + 1;

                // Check for late part indicators
                const isLatePartCandidate =
                    task.isLatePartTask ||
                    task.type === 'Late Part' ||
                    task.taskId.includes('LP_') ||
                    task.taskId.includes('Late') ||
                    task.product === 'Product D'; // Debug Product D specifically

                if (isLatePartCandidate) {
                    latePartCandidates.push({
                        taskId: task.taskId,
                        type: task.type,
                        product: task.product,
                        isLatePartTask: task.isLatePartTask,
                        team: task.team
                    });
                }
            });

            console.log('Task types:', taskTypes);
            console.log(`Late part candidates: ${latePartCandidates.length}`);
            if (latePartCandidates.length > 0) {
                console.log('Sample late parts:', latePartCandidates.slice(0, 5));
            }
        }
    });
}

// Call this in browser console or add it to updateSupplyChainView
debugTaskData();

function getScenarioColor(scenarioId) {
    const colors = {
        baseline: '#10b981',
        scenario1: '#f59e0b',
        scenario2: '#8b5cf6',
        scenario3: '#ef4444'
    };
    return colors[scenarioId] || '#6b7280';
}

function getScheduleStartDate(scenario) {
    if (scenario.tasks && scenario.tasks.length > 0) {
        const dates = scenario.tasks.map(t => new Date(t.startTime));
        return new Date(Math.min(...dates));
    }
    return new Date();
}

function calculateDownstreamImpact(taskId) {
    // This would need to analyze task dependencies
    // For now, return a placeholder
    return Math.floor(Math.random() * 10) + 5;
}

// Setup supply chain filters
function setupSupplyChainFilters() {
    // Setup product filter
    const productFilter = document.getElementById('supplyChainProductFilter');
    if (productFilter && !productFilter.hasAttribute('data-initialized')) {
        productFilter.setAttribute('data-initialized', 'true');

        // Populate products
        const products = new Set();
        Object.values(latePartsData).forEach(parts => {
            parts.forEach(part => products.add(part.product));
        });

        productFilter.innerHTML = '<option value="all">All Products</option>';
        Array.from(products).sort().forEach(product => {
            const option = document.createElement('option');
            option.value = product;
            option.textContent = product;
            productFilter.appendChild(option);
        });

        productFilter.addEventListener('change', () => {
            updateLatePartsTimeline();
            updateLatePartsImpactTable();
        });
    }

    // Setup scenario checkboxes
    document.querySelectorAll('.scenario-compare').forEach(checkbox => {
        if (!checkbox.hasAttribute('data-listener-added')) {
            checkbox.setAttribute('data-listener-added', 'true');
            checkbox.addEventListener('change', () => {
                updateLatePartsTimeline();
                updateProductImpactGrid();
            });
        }
    });
}

// Export supply chain report
window.exportSupplyChainReport = function() {
    let csvContent = "Supply Chain Late Parts Report\n";
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;

    // Summary section
    csvContent += "SUMMARY METRICS\n";
    csvContent += `Total Unique Late Parts,${document.getElementById('totalLateParts').textContent}\n`;
    csvContent += `Affected Products,${document.getElementById('affectedProducts').textContent}\n`;
    csvContent += `Critical Late Parts,${document.getElementById('criticalLateParts').textContent}\n`;
    csvContent += `Average Delay Impact,${document.getElementById('avgDelayImpact').textContent} days\n\n`;

    // Late parts details
    csvContent += "LATE PARTS SCHEDULE COMPARISON\n";
    csvContent += "Task ID,Product,Type,Team,Baseline Day,Scenario1 Day,Scenario2 Day,Scenario3 Day,Critical Path\n";

    const latePartGroups = {};
    Object.entries(latePartsData).forEach(([scenarioId, parts]) => {
        parts.forEach(part => {
            const baseTaskId = part.taskId.split('_')[0];
            if (!latePartGroups[baseTaskId]) {
                latePartGroups[baseTaskId] = {
                    taskId: baseTaskId,
                    product: part.product,
                    type: part.type || 'Late Part',
                    team: part.team || '-',
                    scenarios: {}
                };
            }
            latePartGroups[baseTaskId].scenarios[scenarioId] = {
                dayOfSchedule: part.dayOfSchedule,
                isCritical: part.isCritical
            };
        });
    });

    Object.values(latePartGroups).forEach(group => {
        const baselineDay = group.scenarios.baseline?.dayOfSchedule || '-';
        const scenario1Day = group.scenarios.scenario1?.dayOfSchedule || '-';
        const scenario2Day = group.scenarios.scenario2?.dayOfSchedule || '-';
        const scenario3Day = group.scenarios.scenario3?.dayOfSchedule || '-';
        const isCritical = Object.values(group.scenarios).some(s => s.isCritical) ? 'Yes' : 'No';

        csvContent += `"${group.taskId}","${group.product}","${group.type}","${group.team}",`;
        csvContent += `${baselineDay},${scenario1Day},${scenario2Day},${scenario3Day},${isCritical}\n`;
    });

    // Product impact section
    csvContent += "\nPRODUCT DELIVERY IMPACT\n";
    csvContent += "Product,Late Parts Count,Baseline Impact,Scenario1 Impact,Scenario2 Impact,Scenario3 Impact\n";

    Object.entries(supplyChainMetrics.byProduct).forEach(([product, metrics]) => {
        const latePartCount = Math.floor(metrics.totalParts / 4);
        let impacts = [];

        ['baseline', 'scenario1', 'scenario2', 'scenario3'].forEach(scenarioId => {
            const scenario = allScenarios[scenarioId];
            if (scenario && scenario.products) {
                const productData = scenario.products.find(p => p.name === product);
                if (productData) {
                    const impact = productData.latenessDays > 0 ? `+${productData.latenessDays}d` :
                                  productData.latenessDays < 0 ? `${productData.latenessDays}d` : 'On time';
                    impacts.push(impact);
                } else {
                    impacts.push('-');
                }
            } else {
                impacts.push('-');
            }
        });

        csvContent += `"${product}",${latePartCount},${impacts.join(',')}\n`;
    });

    // Download the CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `supply_chain_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Supply chain report exported successfully!', 'success');
};


// Refresh Gantt chart function
function refreshGanttChart() {
    renderGanttChart();
    showNotification('Gantt chart refreshed', 'success');
}

// Export Gantt chart functionality
function exportGanttChart() {
    const productFilter = document.getElementById('ganttProductSelect').value || 'all';
    const teamFilter = document.getElementById('ganttTeamSelect').value || 'all';
    const sortBy = document.getElementById('ganttSortSelect').value || 'start';
    const viewMode = document.getElementById('ganttViewMode').value || 'Day';

    let tasks = getGanttTasks(productFilter, teamFilter);

    if (tasks.length === 0) {
        alert('No tasks to export for the selected filters.');
        return;
    }

    // Sort tasks (same logic as render)
    switch(sortBy) {
        case 'start':
            tasks.sort((a, b) => new Date(a.start) - new Date(b.start));
            break;
        case 'product':
            tasks.sort((a, b) => {
                if (a.product !== b.product) {
                    return a.product.localeCompare(b.product);
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        case 'priority':
            tasks.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        case 'team':
            tasks.sort((a, b) => {
                if (a.team !== b.team) {
                    return a.team.localeCompare(b.team);
                }
                return new Date(a.start) - new Date(b.start);
            });
            break;
        case 'duration':
            tasks.sort((a, b) => b.duration - a.duration);
            break;
    }

    // Create CSV content
    let csvContent = "Gantt Chart Export\n";
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += `Scenario: ${currentScenario}\n`;
    csvContent += `Filters: Product=${productFilter}, Team=${teamFilter}\n`;
    csvContent += `Sort: ${sortBy}, View: ${viewMode}\n\n`;

    csvContent += "Task ID,Task Name,Product,Team,Type,Priority,Start Date,End Date,Duration (Days),Dependencies\n";

    tasks.forEach(task => {
        const startDate = new Date(task.start).toLocaleDateString();
        const endDate = new Date(task.end).toLocaleDateString();
        const duration = Math.ceil((new Date(task.end) - new Date(task.start)) / (1000 * 60 * 60 * 24));
        const dependencies = task.dependencies || '';

        csvContent += `"${task.id}","${task.name}","${task.product}","${task.team}","${task.type}","${task.priority}","${startDate}","${endDate}","${duration}","${dependencies}"\n`;
    });

    // Download the CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gantt_chart_${currentScenario}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Gantt chart exported successfully!', 'success');
}

// Refresh data
async function refreshData() {
    if (confirm('This will recalculate all scenarios. It may take a few minutes. Continue?')) {
        showLoading('Refreshing all scenarios...');
        try {
            const response = await fetch('/api/refresh', { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                await loadAllScenarios();
                alert('All scenarios refreshed successfully!');
            } else {
                alert('Failed to refresh: ' + result.error);
            }
        } catch (error) {
            alert('Error refreshing data: ' + error.message);
        } finally {
            hideLoading();
        }
    }
}

// Clear all assignments (for current view only, doesn't clear saved)
function clearAllAssignments() {
    if (!confirm('This will clear all current assignments in the view. Continue?')) return;

    // Reset all dropdowns
    document.querySelectorAll('.assign-select').forEach(select => {
        select.value = '';
        select.classList.remove('assigned', 'conflict', 'partial', 'has-saved-assignment');
    });

    // Update summary
    if (typeof updateAssignmentSummary === 'function') {
        updateAssignmentSummary();
    }

    // Visual feedback
    if (typeof showNotification === 'function') {
        showNotification('Current view assignments cleared', 'info');
    } else {
        alert('Current view assignments cleared');
    }
}

// Add refresh button to header if not exists
function setupRefreshButton() {
    const controls = document.querySelector('.controls');
    if (controls && !document.getElementById('refreshBtn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshBtn';
        refreshBtn.className = 'btn btn-secondary';
        refreshBtn.innerHTML = '🔄 Refresh Data';
        refreshBtn.onclick = refreshData;
        refreshBtn.style.marginLeft = '10px';
        controls.appendChild(refreshBtn);
    }
}

// View assignment report
function viewAssignmentReport() {
    if (typeof currentScenario !== 'undefined') {
        window.open(`/api/assignment_report/${currentScenario}`, '_blank');
    }
}

// Update assignment summary panel
function updateAssignmentSummary() {
    const rows = document.querySelectorAll('#taskTableBody tr');
    let total = 0, complete = 0, partial = 0, unassigned = 0;

    rows.forEach(row => {
        total++;
        const selects = row.querySelectorAll('.assign-select');
        const assigned = Array.from(selects).filter(s => s.value).length;
        const needed = selects.length;

        if (assigned === 0) {
            unassigned++;
            row.classList.remove('fully-assigned', 'partially-assigned');
        } else if (assigned < needed) {
            partial++;
            row.classList.remove('fully-assigned');
            row.classList.add('partially-assigned');
        } else {
            complete++;
            row.classList.add('fully-assigned');
            row.classList.remove('partially-assigned');
        }
    });

    // Update summary panel
    document.getElementById('summaryTotal').textContent = total;
    document.getElementById('summaryComplete').textContent = complete;
    document.getElementById('summaryPartial').textContent = partial;
    document.getElementById('summaryUnassigned').textContent = unassigned;

    // Update progress bar
    const progress = total > 0 ? (complete / total) * 100 : 0;
    document.getElementById('summaryProgress').style.width = progress + '%';

    // Show/hide panel
    const panel = document.getElementById('assignmentSummary');
    if (panel) {
        if (total > 0) {
            panel.classList.add('visible');
        } else {
            panel.classList.remove('visible');
        }
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========= CUSTOM GANTT CHART IMPLEMENTATION =========
// Add this to your dashboard-js.js file

let customGanttTasks = [];
let customGanttViewMode = 'days';

// Enhanced update view to use custom Gantt
function updateView() {
    if (!scenarioData) return;

    if (currentView === 'team-lead') {
        updateTeamLeadView();
    } else if (currentView === 'management') {
        updateManagementView();
    } else if (currentView === 'mechanic') {
        updateMechanicView();
    } else if (currentView === 'project') {
        // Use custom Gantt chart instead of timeline
        initializeCustomGantt();
    } else if (currentView === 'supply-chain') {
        updateSupplyChainView();
    }
}

// Initialize custom Gantt chart
function initializeCustomGantt() {
    console.log('Initializing custom Gantt chart...');

    if (!scenarioData || !scenarioData.tasks) {
        console.error('No task data available for Gantt chart');
        return;
    }

    // Convert task data to Gantt format
    customGanttTasks = convertTasksToGanttFormat(scenarioData.tasks);

    // Populate filter dropdowns
    populateGanttFilters();

    // Render the Gantt chart
    renderCustomGanttChart();
}

// Convert dashboard tasks to Gantt format
function convertTasksToGanttFormat(tasks) {
    return tasks.map(task => {
        const startDate = new Date(task.startTime);
        const endDate = new Date(task.endTime);

        // Determine task type for styling
        let taskType = 'production';
        if (task.isCustomerTask || task.type === 'Customer' || task.type === 'Customer Inspection') {
            taskType = 'customer';
        } else if (task.type === 'Quality Inspection') {
            taskType = 'quality';
        } else if (task.isLatePartTask || task.type === 'Late Part') {
            taskType = 'late-part';
        } else if (task.isReworkTask || task.type === 'Rework') {
            taskType = 'rework';
        }

        return {
            id: task.taskId,
            name: `${task.taskId} - ${task.type || 'Task'}`,
            type: taskType,
            originalType: task.type,
            product: task.product,
            team: task.team,
            startDate: startDate,
            endDate: endDate,
            duration: task.duration || Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
            progress: task.progress || 0,
            critical: task.isCritical || task.priority <= 10,
            priority: task.priority || 999,
            dependencies: task.dependencies || []
        };
    });
}

function convertTasksToGanttFormat(tasks) {
    return tasks.map(task => {
        const startDate = new Date(task.startTime);
        const endDate = new Date(task.endTime);

        // Calculate actual duration in days (not minutes)
        const durationDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));

        // Determine task type for styling
        let taskType = 'production';
        if (task.isCustomerTask || task.type === 'Customer' || task.type === 'Customer Inspection') {
            taskType = 'customer';
        } else if (task.type === 'Quality Inspection') {
            taskType = 'quality';
        } else if (task.isLatePartTask || task.type === 'Late Part') {
            taskType = 'late-part';
        } else if (task.isReworkTask || task.type === 'Rework') {
            taskType = 'rework';
        }

        return {
            id: task.taskId,
            name: `${task.taskId} - ${task.type || 'Task'}`,
            type: taskType,
            originalType: task.type,
            product: task.product,
            team: task.team,
            startDate: startDate,
            endDate: endDate,
            duration: durationDays, // Now correctly in days
            progress: task.progress || 0,
            critical: task.isCritical || task.priority <= 10,
            priority: task.priority || 999,
            dependencies: task.dependencies || []
        };
    });
}

// 4. Add initialization check
function initializeCustomGantt() {
    console.log('Initializing custom Gantt chart...');

    if (!scenarioData || !scenarioData.tasks) {
        console.error('No task data available for Gantt chart');

        // Show message in the Gantt area
        const container = document.querySelector('.gantt-container-new');
        if (container) {
            container.innerHTML = `
                <div style="padding: 40px; text-align: center; color: #6b7280;">
                    <h3>No Task Data Available</h3>
                    <p>Please ensure scenario data is loaded properly.</p>
                </div>
            `;
        }
        return;
    }

    console.log(`Converting ${scenarioData.tasks.length} tasks to Gantt format...`);

    // Convert task data to Gantt format
    customGanttTasks = convertTasksToGanttFormat(scenarioData.tasks);

    console.log(`Converted to ${customGanttTasks.length} Gantt tasks`);

    // Populate filter dropdowns
    populateGanttFilters();

    // Render the Gantt chart
    renderCustomGanttChart();

    console.log('Custom Gantt chart initialization complete');
}

// Generate date range for Gantt chart
function generateGanttDateRange(tasks, mode = 'days') {
    if (tasks.length === 0) {
        const today = new Date();
        return [today];
    }

    const startDates = tasks.map(t => t.startDate);
    const endDates = tasks.map(t => t.endDate);
    const minStart = new Date(Math.min(...startDates));
    const maxEnd = new Date(Math.max(...endDates));

    // Add padding
    minStart.setDate(minStart.getDate() - 2);
    maxEnd.setDate(maxEnd.getDate() + 2);

    const dates = [];
    const current = new Date(minStart);

    while (current <= maxEnd) {
        dates.push(new Date(current));
        if (mode === 'days') {
            current.setDate(current.getDate() + 1);
        } else if (mode === 'weeks') {
            current.setDate(current.getDate() + 7);
        }
    }

    return dates;
}

// Get filtered tasks based on current selections
function getFilteredGanttTasks() {
    const productFilter = document.getElementById('ganttProductFilter')?.value || 'all';
    const teamFilter = document.getElementById('ganttTeamFilter')?.value || 'all';
    const sortBy = document.getElementById('ganttSortBy')?.value || 'startDate';

    let filtered = [...customGanttTasks];

    // Apply filters
    if (productFilter !== 'all') {
        filtered = filtered.filter(task => task.product === productFilter);
    }

    if (teamFilter !== 'all') {
        filtered = filtered.filter(task => task.team === teamFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'startDate':
                return a.startDate - b.startDate;
            case 'product':
                return a.product.localeCompare(b.product) || a.startDate - b.startDate;
            case 'team':
                return a.team.localeCompare(b.team) || a.startDate - b.startDate;
            case 'priority':
                return a.priority - b.priority || a.startDate - b.startDate;
            default:
                return a.startDate - b.startDate;
        }
    });

    return filtered;
}

// Render the complete Gantt chart
function renderCustomGanttChart() {
    const tasks = getFilteredGanttTasks();
    const dates = generateGanttDateRange(tasks, customGanttViewMode);

    renderGanttHeader(dates);
    renderGanttTasks(tasks, dates);
    updateGanttStats(tasks);
    console.log(`Rendered Gantt chart with ${tasks.length} tasks and ${dates.length} date columns`);
}

// Render Gantt chart header
function renderGanttHeader(dates) {
    const header = document.getElementById('ganttHeaderNew');
    if (!header) return;

    header.innerHTML = '';

    const headerRow = document.createElement('tr');

    // Task column header
    const taskHeader = document.createElement('th');
    taskHeader.style.cssText = `
        min-width: 250px;
        max-width: 250px;
        text-align: left;
        padding: 12px;
        background: #f1f5f9;
        position: sticky;
        left: 0;
        z-index: 11;
        border-bottom: 2px solid #e5e7eb;
        border-right: 2px solid #d1d5db;
        font-weight: 600;
        color: #374151;
    `;
    taskHeader.textContent = 'Tasks';
    headerRow.appendChild(taskHeader);

    // Date column headers
    dates.forEach(date => {
        const dateHeader = document.createElement('th');
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isToday = date.toDateString() === new Date().toDateString();

        dateHeader.style.cssText = `
            min-width: 40px;
            width: 40px;
            text-align: center;
            padding: 8px 4px;
            border-bottom: 2px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            font-weight: 600;
            font-size: 11px;
            color: ${isToday ? '#ef4444' : '#374151'};
            background: ${isWeekend ? '#f9fafb' : isToday ? '#fef2f2' : '#f8fafc'};
            writing-mode: vertical-rl;
            text-orientation: mixed;
        `;

        if (customGanttViewMode === 'days') {
            dateHeader.textContent = date.getDate().toString().padStart(2, '0');
        } else {
            dateHeader.textContent = `W${getWeekNumber(date)}`;
        }

        dateHeader.title = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        headerRow.appendChild(dateHeader);
    });

    header.appendChild(headerRow);
}

// Render Gantt chart task rows
function renderGanttTasks(tasks, dates) {
    const tbody = document.getElementById('ganttBodyNew');
    if (!tbody) {
        console.error('Gantt tbody not found');
        return;
    }

    tbody.innerHTML = '';

    tasks.forEach((task, taskIndex) => {
        const row = document.createElement('tr');
        row.style.cssText = `
            height: 36px;
            background: ${taskIndex % 2 === 0 ? 'white' : '#fafbfc'};
        `;
        row.addEventListener('mouseenter', () => row.style.background = '#f0f9ff');
        row.addEventListener('mouseleave', () => row.style.background = taskIndex % 2 === 0 ? 'white' : '#fafbfc');

        // Task name cell
        const taskCell = document.createElement('td');
        taskCell.style.cssText = `
            min-width: 250px;
            max-width: 250px;
            padding: 8px 12px;
            background: #f8fafc;
            position: sticky;
            left: 0;
            z-index: 9;
            border-right: 2px solid #d1d5db;
            border-bottom: 1px solid #f3f4f6;
            vertical-align: middle;
        `;

        taskCell.innerHTML = `
            <div style="font-weight: 600; color: #1f2937; font-size: 13px; margin-bottom: 2px;">
                ${task.name || task.id}
            </div>
            <div style="color: #6b7280; font-size: 11px;">
                ${task.team || 'Unknown Team'} • ${task.product || 'Unknown Product'}
                ${task.critical ? ' • <span style="color: #ef4444;">CRITICAL</span>' : ''}
            </div>
        `;
        row.appendChild(taskCell);

        // Date cells with task bars
        let taskBarRendered = false;

        dates.forEach((date, dateIndex) => {
            const dateCell = document.createElement('td');
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = date.toDateString() === new Date().toDateString();

            dateCell.style.cssText = `
                min-width: 40px;
                width: 40px;
                padding: 0;
                margin: 0;
                position: relative;
                height: 36px;
                vertical-align: middle;
                border-right: 1px solid #e5e7eb;
                border-bottom: 1px solid #f3f4f6;
                background: ${isWeekend ? '#f9fafb' : isToday ? '#fef2f2' : 'transparent'};
            `;

            // Check if task spans this date and render bar on first occurrence
            if (date >= task.startDate && date <= task.endDate && !taskBarRendered) {
                const taskPosition = calculateGanttTaskPosition(task, dates);

                const bar = document.createElement('div');
                bar.style.cssText = `
                    position: absolute;
                    top: 4px;
                    left: 1px;
                    height: 28px;
                    width: ${taskPosition.width * 40 - 2}px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    padding: 0 8px;
                    color: white;
                    font-weight: 500;
                    font-size: 11px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    ${getTaskBarStyle(task.type)};
                    ${task.critical ? 'border: 2px solid #fbbf24; box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.2);' : ''}
                `;

                bar.textContent = task.id;

                // Enhanced tooltip
                const startDateStr = task.startDate.toLocaleDateString();
                const endDateStr = task.endDate.toLocaleDateString();
                const durationDays = Math.ceil((task.endDate - task.startDate) / (1000 * 60 * 60 * 24));

                bar.title = `${task.name || task.id}\nStart: ${startDateStr}\nEnd: ${endDateStr}\nDuration: ${durationDays} days\nTeam: ${task.team || 'Unknown'}\nProduct: ${task.product || 'Unknown'}${task.critical ? '\n⚠️ CRITICAL TASK' : ''}`;

                bar.addEventListener('mouseenter', () => {
                    bar.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                    bar.style.transform = 'translateY(-1px)';
                });

                bar.addEventListener('mouseleave', () => {
                    bar.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
                    bar.style.transform = 'translateY(0)';
                });

                dateCell.appendChild(bar);
                taskBarRendered = true;
            }

            row.appendChild(dateCell);
        });

        tbody.appendChild(row);
    });

    console.log(`Rendered ${tasks.length} task rows`);
}


// Calculate task position in the Gantt chart
function calculateGanttTaskPosition(task, dates) {
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];

        if (task.startDate.toDateString() === date.toDateString()) {
            startIndex = i;
        }

        if (task.endDate.toDateString() === date.toDateString()) {
            endIndex = i;
        }
    }

    // Handle tasks that start before or end after visible range
    if (startIndex === -1) startIndex = 0;
    if (endIndex === -1) endIndex = dates.length - 1;

    return {
        startIndex: startIndex,
        endIndex: endIndex,
        width: endIndex - startIndex + 1
    };
}

// Get task bar CSS styles based on task type
function getTaskBarStyle(type) {
    const styles = {
        'production': 'background: linear-gradient(135deg, #10b981, #059669);',
        'quality': 'background: linear-gradient(135deg, #3b82f6, #2563eb);',
        'rework': 'background: linear-gradient(135deg, #ef4444, #dc2626);',
        'late-part': 'background: linear-gradient(135deg, #f59e0b, #d97706);',
        'customer': 'background: linear-gradient(135deg, #8b5cf6, #7c3aed);'
    };

    return styles[type] || styles['production'];
}

// Get week number helper function
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Update Gantt chart statistics
// 1. Fix the duration calculation
function updateGanttStats(tasks) {

    // Ensure DOM elements exist
    const totalTasksEl = document.getElementById('ganttTotalTasks');
    const totalDurationEl = document.getElementById('ganttTotalDuration');
    const criticalTasksEl = document.getElementById('ganttCriticalTasks');
    const completionRateEl = document.getElementById('ganttCompletionRate');

    if (!totalTasksEl || !totalDurationEl || !criticalTasksEl || !completionRateEl) {
        console.error('Gantt stats elements not found in DOM');
        return;
    }

    totalTasksEl.textContent = tasks.length;

    // FIX: Calculate project makespan, not sum of task durations
    if (tasks.length > 0) {
        const startDates = tasks.map(t => t.startDate);
        const endDates = tasks.map(t => t.endDate);
        const projectStart = new Date(Math.min(...startDates));
        const projectEnd = new Date(Math.max(...endDates));

        // Calculate actual project duration (makespan)
        const makespanDays = Math.ceil((projectEnd - projectStart) / (1000 * 60 * 60 * 24));
        totalDurationEl.textContent = makespanDays + ' days';

        // Log debug info
        console.log(`Project Makespan: ${makespanDays} days (${projectStart.toLocaleDateString()} to ${projectEnd.toLocaleDateString()})`);
    } else {
        totalDurationEl.textContent = '0 days';
    }

    const criticalCount = tasks.filter(t => t.critical).length;
    criticalTasksEl.textContent = criticalCount;

    // Fix progress calculation - use scenario data if available
    let completionRate = 0;
    if (scenarioData && scenarioData.onTimeRate !== undefined) {
        completionRate = scenarioData.onTimeRate;
    } else {
        // Fallback to progress-based calculation
        const onScheduleCount = tasks.filter(t => t.progress >= 75).length;
        completionRate = tasks.length > 0 ? Math.round((onScheduleCount / tasks.length) * 100) : 0;
    }
    completionRateEl.textContent = completionRate + '%';
}


// Populate Gantt filter dropdowns
function populateGanttFilters() {
    if (customGanttTasks.length === 0) return;

    // Populate product filter
    const products = [...new Set(customGanttTasks.map(t => t.product))].sort();
    const productSelect = document.getElementById('ganttProductFilter');
    if (productSelect) {
        productSelect.innerHTML = '<option value="all">All Products</option>';
        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product;
            option.textContent = product;
            productSelect.appendChild(option);
        });
    }

    // Populate team filter
    const teams = [...new Set(customGanttTasks.map(t => t.team))].sort();
    const teamSelect = document.getElementById('ganttTeamFilter');
    if (teamSelect) {
        teamSelect.innerHTML = '<option value="all">All Teams</option>';
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team;
            option.textContent = team;
            teamSelect.appendChild(option);
        });
    }

    // Add event listeners
    const filterElements = ['ganttProductFilter', 'ganttTeamFilter', 'ganttSortBy'];
    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element && !element.hasAttribute('data-listener-added')) {
            element.setAttribute('data-listener-added', 'true');
            element.addEventListener('change', renderCustomGanttChart);
        }
    });

    const viewModeSelect = document.getElementById('ganttViewMode');
    if (viewModeSelect && !viewModeSelect.hasAttribute('data-listener-added')) {
        viewModeSelect.setAttribute('data-listener-added', 'true');
        viewModeSelect.addEventListener('change', () => {
            customGanttViewMode = viewModeSelect.value;
            renderCustomGanttChart();
        });
    }
}

function updateGanttStatsDetailed(tasks) {
    document.getElementById('ganttTotalTasks').textContent = tasks.length;

    if (tasks.length > 0) {
        const startDates = tasks.map(t => t.startDate);
        const endDates = tasks.map(t => t.endDate);
        const projectStart = new Date(Math.min(...startDates));
        const projectEnd = new Date(Math.max(...endDates));

        // Calculate makespan
        const makespanDays = Math.ceil((projectEnd - projectStart) / (1000 * 60 * 60 * 24));
        document.getElementById('ganttTotalDuration').textContent = makespanDays + ' days';

        // Add additional stats if you want them
        console.log(`Project Statistics:
        - Project Start: ${projectStart.toLocaleDateString()}
        - Project End: ${projectEnd.toLocaleDateString()}
        - Makespan: ${makespanDays} days
        - Total Tasks: ${tasks.length}
        - Average Task Duration: ${(tasks.reduce((sum, t) => sum + t.duration, 0) / tasks.length).toFixed(1)} days
        - Parallel Efficiency: ${((tasks.reduce((sum, t) => sum + t.duration, 0)) / makespanDays).toFixed(1)}x`);
    } else {
        document.getElementById('ganttTotalDuration').textContent = '0 days';
    }

    const criticalCount = tasks.filter(t => t.critical).length;
    document.getElementById('ganttCriticalTasks').textContent = criticalCount;

    const onScheduleCount = tasks.filter(t => t.progress >= 75).length;
    const completionRate = tasks.length > 0 ? Math.round((onScheduleCount / tasks.length) * 100) : 0;
    document.getElementById('ganttCompletionRate').textContent = completionRate + '%';

// Global functions for buttons
function refreshCustomGantt() {
    renderCustomGanttChart();
    showNotification('Gantt chart refreshed', 'success');
}

function exportCustomGantt() {
    const tasks = getFilteredGanttTasks();

    if (tasks.length === 0) {
        alert('No tasks to export');
        return;
    }

    let csvContent = "Task ID,Task Name,Type,Product,Team,Start Date,End Date,Duration (Days),Progress,Critical,Priority\n";

    tasks.forEach(task => {
        csvContent += `"${task.id}","${task.name}","${task.originalType}","${task.product}","${task.team}","${task.startDate.toISOString()}","${task.endDate.toISOString()}","${task.duration}","${task.progress}%","${task.critical}","${task.priority}"\n`;
    });

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gantt_chart_${currentScenario}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Gantt chart exported successfully!', 'success');
}

function fitGanttToTasks() {
    const container = document.querySelector('.gantt-container-new');
    if (container) {
        container.scrollLeft = 0;
        showNotification('Gantt chart reset to beginning', 'info');
    }
}

// Make functions globally available
window.refreshCustomGantt = refreshCustomGantt;
window.exportCustomGantt = exportCustomGantt;
window.fitGanttToTasks = fitGanttToTasks;

// Expose functions globally for HTML onclick handlers
window.autoAssign = autoAssign;
window.saveAssignmentsToStorage = saveAssignmentsToStorage;
window.loadAssignmentsFromStorage = loadAssignmentsFromStorage;
window.clearSavedAssignments = clearSavedAssignments;
window.clearAllAssignments = clearAllAssignments;
window.exportTasks = exportTasks;
window.viewAssignmentReport = viewAssignmentReport;
window.updateAssignmentSummary = updateAssignmentSummary;
window.showNotification = showNotification;
// Make functions available globally
window.handleGanttSortChange = handleGanttSortChange;
window.refreshGanttChart = refreshGanttChart;
window.exportGanttChart = exportGanttChart;

// Make functions globally available
window.refreshTimeline = refreshTimeline;
window.exportTimelineData = exportTimelineData;
window.fitTimelineToTasks = fitTimelineToTasks
}