class Colorbar {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            width: options.width || 40,
            height: options.height || 300,
            min: options.min || 0,
            max: options.max || 100,
            numTicks: options.numTicks || 5,
            colormap: options.colormap || ['blue', 'red'],
            label: options.label || '',
            dateFormat: options.dateFormat || 'short'
        };

        this.isDateScale = this.options.min instanceof Date ||
            typeof this.options.min === 'string' && !isNaN(Date.parse(this.options.min));

        if (this.isDateScale) {
            this.options.min = this.ensureDate(this.options.min);
            this.options.max = this.ensureDate(this.options.max);
            this.analyzeDateTimeRange();
        } else {
            // Analyze numeric data range
            this.analyzeNumericRange();
        }

        this.render();
    }

    analyzeDateTimeRange() {
        const { min, max } = this.options;
        const rangeMs = max.getTime() - min.getTime();
        const rangeHours = rangeMs / (1000 * 60 * 60);
        const rangeDays = rangeHours / 24;
        const rangeMonths = rangeDays / 30.44; // Average month length
        const rangeYears = rangeMonths / 12;

        // Determine the appropriate format based on the range
        if (rangeYears >= 2) {
            this.dateTimeFormat = { year: 'numeric', month: 'short' };
        } else if (rangeMonths >= 2) {
            this.dateTimeFormat = { month: 'short', day: 'numeric' };
        } else if (rangeDays >= 2) {
            this.dateTimeFormat = { month: 'short', day: 'numeric', hour: '2-digit' };
        } else if (rangeHours >= 2) {
            this.dateTimeFormat = { hour: '2-digit', minute: '2-digit' };
        } else {
            this.dateTimeFormat = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        }
    }

    analyzeNumericRange() {
        const { min, max } = this.options;
        this.isIntegerData = Number.isInteger(min) && Number.isInteger(max);

        // Determine the scale of the data
        const maxAbs = Math.max(Math.abs(min), Math.abs(max));
        const minAbs = Math.min(Math.abs(min), Math.abs(max));

        // Check if we need scientific notation
        this.useScientific = maxAbs >= 1e5 || (minAbs > 0 && minAbs <= 1e-4);

        // Determine decimal places for floating point numbers
        if (!this.isIntegerData && !this.useScientific) {
            const range = max - min;
            if (range < 1) {
                this.decimals = 3;
            } else if (range < 10) {
                this.decimals = 2;
            } else {
                this.decimals = 1;
            }
        }
    }

    ensureDate(value) {
        if (value instanceof Date) return value;
        return new Date(value);
    }

    formatNumber(value) {
        if (this.isIntegerData) {
            return Math.round(value).toString();
        }

        if (this.useScientific) {
            return value.toExponential(2);
        }

        if (Number.isInteger(value)) {
            return value.toString();
        }

        return value.toFixed(this.decimals);
    }

    formatValue(value) {
        if (this.isDateScale) {
            const date = value instanceof Date ? value : new Date(value);
            if (this.options.dateFormat) {
                // Use specified format if provided
                return date.toLocaleDateString(undefined, this.options.dateFormat);
            } else {
                // Use auto-detected format
                return date.toLocaleString(undefined, this.dateTimeFormat);
            }
        }

        return this.formatNumber(value);
    }

    createColorScale() {
        const { colormap } = this.options;
        if (colormap.length === 0) return 'none';
        if (colormap.length === 1) return colormap[0];

        return `linear-gradient(to top, ${colormap.join(', ')})`;
    }

    generateTicks() {
        const { min, max, numTicks } = this.options;
        const ticks = [];

        for (let i = numTicks - 1; i >= 0; i--) {
            let value;
            if (this.isDateScale) {
                const minTime = min.getTime();
                const maxTime = max.getTime();
                const timeRange = maxTime - minTime;
                value = new Date(minTime + (i / (numTicks - 1)) * timeRange);
            } else {
                value = min + (i / (numTicks - 1)) * (max - min);
            }

            const position = 100 - (i / (numTicks - 1) * 100);
            ticks.push({
                value: value,
                formattedValue: this.formatValue(value),
                position
            });
        }
        return ticks;
    }

    render() {
        // Create container
        const wrapper = document.createElement('div');
        wrapper.className = 'colorbar-container';

        // Create colorbar
        const colorbar = document.createElement('div');
        colorbar.className = 'colorbar';
        colorbar.style.background = this.createColorScale();

        // Create tick container
        const tickContainer = document.createElement('div');
        tickContainer.className = 'tick-container';

        // Add ticks
        const ticks = this.generateTicks();
        ticks.forEach(tick => {
            const tickElement = document.createElement('div');
            tickElement.className = 'tick';
            tickElement.style.top = `${tick.position}%`;

            const tickLine = document.createElement('div');
            tickLine.className = 'tick-line';

            const tickLabel = document.createElement('div');
            tickLabel.className = 'tick-label';
            tickLabel.textContent = tick.formattedValue;

            tickElement.appendChild(tickLine);
            tickElement.appendChild(tickLabel);
            tickContainer.appendChild(tickElement);
        });

        // Add label if provided
        if (this.options.label) {
            const label = document.createElement('div');
            label.style.writingMode = 'vertical-rl';
            label.style.transform = 'rotate(180deg)';
            label.style.marginRight = '8px';
            label.textContent = this.options.label;
            wrapper.appendChild(label);
        }

        wrapper.appendChild(colorbar);
        wrapper.appendChild(tickContainer);
        this.container.appendChild(wrapper);
    }
}

function convertRGBtoObj(colorString) {
    const rgbKeys = ['r', 'g', 'b', 'a'];
    let rgbObj = {};
    let color = colorString.replace(/^rgba?\(|\s+|\)$/g, '').split(',');

    for (let i in rgbKeys)
        rgbObj[rgbKeys[i]] = parseInt(color[i]) || 1;

    return rgbObj;
}

class ColorLegend {
    constructor(container, datamap, colorData, colorField, options = {}) {
        this.container = container;
        this.options = {
            width: options.width || 400,
            colormap: options.colormap || { "High": "blue", "Low": "red" },
            label: options.label || ''
        };
        this.datamap = datamap;
        this.colorData = colorData;
        this.colorField = colorField;
        this.selectedItems = new Set();
        this.legendItems = [];
        this.render();
    }

    render() {
        for (const [label, color] of Object.entries(this.options.colormap)) {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';

            const colorBox = document.createElement('div');
            colorBox.className = 'color-swatch-box';
            colorBox.style.borderRadius = "2px";
            colorBox.style.backgroundColor = color;

            const labelElement = document.createElement('div');
            labelElement.className = 'legend-label';
            labelElement.textContent = label;

            legendItem.appendChild(colorBox);
            legendItem.appendChild(labelElement);
            this.container.appendChild(legendItem);
            this.legendItems.push(legendItem);
        }
        this.container.addEventListener('click', (event) => {
            const selection = event.srcElement.style.backgroundColor;
            if (selection) {
                if (this.selectedItems.has(selection)) {
                    this.selectedItems.delete(selection);
                } else {
                    this.selectedItems.add(selection);
                }
                const selectedIndices = [];
                this.selectedItems.forEach((color) => {
                    const selectedColor = convertRGBtoObj(color);
                    for (let i = 0; i < this.colorData[`${this.colorField}_r`].length; i++) {
                        if (Math.abs(this.colorData[`${this.colorField}_r`][i] - selectedColor.r) <= 1 &&
                            Math.abs(this.colorData[`${this.colorField}_g`][i] - selectedColor.g) <= 1 &&
                            Math.abs(this.colorData[`${this.colorField}_b`][i] - selectedColor.b) <= 1) {
                            selectedIndices.push(i);
                        }
                    }
                });
                this.datamap.addSelection(selectedIndices, "legend");
                if (this.selectedItems.size > 0) {
                    this.legendItems.forEach((item) => {
                        if (this.selectedItems.has(item.children[0].style.backgroundColor)) {
                            item.style.opacity = 1;
                        } else {
                            item.style.opacity = 0.33;
                        }
                    });
                } else {
                    this.legendItems.forEach((item) => {
                        item.style.opacity = 1;
                    });
                }
            }
        });
    }
}

class ColormapSelectorTool {
    constructor(colorMaps, colorMapContainer, colorData, legendContainer, datamap, nColors = 5) {
        this.colorMaps = colorMaps;
        this.colorMapContainer = colorMapContainer;
        this.colorData = colorData;
        this.datamap = datamap;
        this.nColors = nColors;
        this.legendContainer = legendContainer;

        for (const colorMap of this.colorMaps) {
            if (Object.hasOwn(colorMap, "nColors")) {
                this.nColors = Math.max(this.nColors, colorMap.nColors);
            }
        }

        this.selectedColorMap = colorMaps[0];

        // Create search input and SVG-based clear button
        this.searchInput = document.createElement("input");
        this.searchInput.type = "text";
        this.searchInput.placeholder = "Search colormaps...";
        this.searchInput.className = "color-map-search";

        this.clearButton = document.createElement("button");
        this.clearButton.className = "clear-button";
        this.clearButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <line x1="4" y1="4" x2="20" y2="20" stroke="black" stroke-width="2" />
                <line x1="4" y1="20" x2="20" y2="4" stroke="black" stroke-width="2" />
            </svg>
        `;
        this.clearButton.title = "Clear search";

        this.measureDiv = document.createElement("div");
        this.measureDiv.style.position = "absolute";
        this.measureDiv.style.visibility = "hidden";
        this.measureDiv.style.whiteSpace = "nowrap";
        document.body.appendChild(this.measureDiv);

        const maxWidth = this.calculateMaxWidth();

        this.colorMapDropdown = document.createElement("div");
        this.colorMapDropdown.className = "color-map-dropdown";
        this.colorMapDropdown.style.width = `${maxWidth}px`;

        const colorMapSelected = document.createElement("div");
        colorMapSelected.className = "color-map-selected";
        this.selectedColorSwatch = document.createElement("span");
        this.selectedColorSwatch.className = "color-swatch";
        this.selectedColorSwatch.id = "selectedColorSwatch";
        colorMapSelected.appendChild(this.selectedColorSwatch);

        this.selectedColorMapText = document.createElement("span");
        this.selectedColorMapText.className = "color-map-text";
        this.selectedColorMapText.id = "selectedColorMapText";
        colorMapSelected.appendChild(this.selectedColorMapText);

        const downArrow = document.createElement("span");
        downArrow.className = "dropdown-arrow";
        downArrow.innerHTML = "▼";
        colorMapSelected.appendChild(downArrow);
        this.colorMapDropdown.appendChild(colorMapSelected);

        this.colorMapOptions = document.createElement("div");
        this.colorMapOptions.className = "color-map-options";
        this.colorMapOptions.id = "colorMapOptions";
        this.colorMapOptions.style.display = 'none';
        this.colorMapOptions.style.width = `${maxWidth}px`;

        // Add search input and clear button to dropdown
        this.colorMapOptions.appendChild(this.searchInput);
        this.colorMapOptions.appendChild(this.clearButton);

        this.colorMapDropdown.appendChild(this.colorMapOptions);
        this.colorMapContainer.appendChild(this.colorMapDropdown);
        this.colorMapContainer.style.width = `${maxWidth + 20}px`;

        // Create reset button as a separate entity
        this.resetButton = document.createElement("button");
        this.resetButton.className = "reset-button";
        this.resetButton.title = "Reset colormap to default";
        this.resetButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <line x1="4" y1="4" x2="20" y2="20" stroke="black" stroke-width="2" />
                <line x1="4" y1="20" x2="20" y2="4" stroke="black" stroke-width="2" />
            </svg>
        `;
        this.colorMapContainer.appendChild(this.resetButton); // Append next to dropdown DEW

        this.searchInput.addEventListener("input", () => this.filterColorMapOptions());
        this.clearButton.addEventListener("click", () => this.resetSearch());
        this.resetButton.addEventListener("click", () => this.handleResetColormap());

        this.colorMapDropdown.addEventListener('click', (e) => {
            if (e.target !== this.searchInput) {
                this.colorMapOptions.style.display = this.colorMapOptions.style.display === 'none' ? 'block' : 'none';
            }
        });

        this.updateSelectedColorMap();
        this.populateColorMapOptions();
        this.populateLegends();

        document.body.removeChild(this.measureDiv);
    }

    handleResetColormap() {
        this.selectedColorMap = this.colorMaps[0]; // Reset to default colormap
        this.updateSelectedColorMap(); // Update the displayed colormap
        this.datamap.resetPointColors(); // Clear colors from datamap
        this.legendContainer.style.display = 'none'; // Hide the legend
        this.colorMapOptions.style.display = 'none'; // Close the dropdown if it's open
        // Clear the search input
        this.searchInput.value = ""; 
        this.filterColorMapOptions(); // Ensure all options are shown again
    }

    calculateMaxWidth() {
        let maxWidth = 0;

        this.measureDiv.className = "color-map-option";

        for (const colorMap of this.colorMaps) {
            this.measureDiv.innerHTML = `${this.createColorSwatch(colorMap.colors)} <span class="color-map-text">${colorMap.description}</span>`;
            const width = this.measureDiv.offsetWidth + 40;
            maxWidth = Math.max(maxWidth, width);
        }

        return maxWidth;
    }

    createColorSwatch(colors, categorical = false) {
        const n = Math.min(this.nColors, colors.length);
        var result = '<span class="color-swatch">'
        if (colors.length > 16 && !categorical) {
            const stepSize = (colors.length - 1) / (n - 1);
            for (let i = 0; i < colors.length; i += stepSize) {
                result += `<span class="color-swatch-box"; style="background: ${colors[Math.round(i)]}"></span>`
            }
        } else {
            for (let i = 0; i < n; i++) {
                result += `<span class="color-swatch-box"; style="background: ${colors[Math.round(i)]}"></span>`
            }
        }
        result += '</span>'
        return result;
    }

    filterColorMapOptions() {
        const searchTerm = this.searchInput.value.toLowerCase();
        this.colorMapOptions.querySelectorAll('.color-map-option').forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    }

    resetSearch() {
        this.searchInput.value = "";
        this.filterColorMapOptions();
    }

    handleColorMapSelection(colorMap) {
        this.selectedColorMap = colorMap;
        this.updateSelectedColorMap();

        if (colorMap.field === 'none') {
            this.datamap.resetPointColors();
            this.legendContainer.style.display = 'none';
        } else {
            this.datamap.recolorPoints(this.colorData, colorMap.field);
            if (((colorMap.kind === "categorical") && (colorMap.colors.length <= 20) && Object.hasOwn(colorMap, "colorMapping")) || (colorMap.kind === "continuous") || (colorMap.kind === "datetime")) {
                this.legendContainer.style.display = 'block';
                for (const key in this.legends) {
                    this.legends[key].style.display = 'none';
                }
                this.legends[colorMap.field].style.display = 'block';
            } else {
                this.legendContainer.style.display = 'none';
            }
        }
    }

    updateSelectedColorMap() {
        this.selectedColorSwatch.innerHTML = (this.createColorSwatch(this.selectedColorMap.colors, this.selectedColorMap.kind === "categorical"));
        this.selectedColorMapText.innerHTML = this.selectedColorMap.description;
    }

    populateColorMapOptions() {
        for (const colorMap of this.colorMaps) {
            const colorMapOption = document.createElement("div");
            colorMapOption.className = "color-map-option";
            colorMapOption.addEventListener('click', (event) => { this.handleColorMapSelection(colorMap) });
            colorMapOption.innerHTML = `${this.createColorSwatch(colorMap.colors, colorMap.kind === "categorical")} <span class="color-map-text">${colorMap.description}</span>`;
            this.colorMapOptions.appendChild(colorMapOption);
        }
    }

    populateLegends() {
        this.legends = {};
        for (const colorMap of this.colorMaps) {
            if (colorMap.field === 'none') {
                continue;
            }
            this.legends[colorMap.field] = document.createElement("div");
            this.legends[colorMap.field].style.display = 'none';
            if ((colorMap.kind === "categorical") && (colorMap.colors.length <= 20) && Object.hasOwn(colorMap, "colorMapping")) {
                new ColorLegend(this.legends[colorMap.field], this.datamap, this.colorData, colorMap.field, { colormap: colorMap.colorMapping });
            } else if (colorMap.kind === "continuous") {
                new Colorbar(this.legends[colorMap.field], { colormap: colorMap.colors, label: colorMap.description, min: colorMap.valueRange[0], max: colorMap.valueRange[1] });
            } else if (colorMap.kind === "datetime") {
                new Colorbar(this.legends[colorMap.field], { colormap: colorMap.colors, label: colorMap.description, min: new Date(colorMap.valueRange[0]), max: new Date(colorMap.valueRange[1]), dateFormat: colorMap.dateFormat });
            }
            this.legendContainer.appendChild(this.legends[colorMap.field]);
        }
    }
}
